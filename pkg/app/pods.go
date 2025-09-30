package app

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/creack/pty"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

// ShellSession manages a shell or pod exec session
// Supports local shell (cmd/bash) and in-cluster exec with PTY
// Streams output to frontend and accepts input
// Robust session management

type ShellSession struct {
	Cmd    *exec.Cmd
	PTY    io.ReadWriteCloser // PTY for interactive local shell
	Stdin  io.WriteCloser     // For in-cluster exec or non-PTY shells
	Cancel context.CancelFunc // For stopping session
	SizeQ  *terminalSizeQueue // For in-cluster exec resize handling
}

// terminalSizeQueue implements remotecommand.TerminalSizeQueue
// allowing us to push resize events from the frontend.
// It is non-blocking on push and blocking on Next() until a size arrives
// or the queue is closed via Close().

type terminalSizeQueue struct {
	ch   chan remotecommand.TerminalSize
	once sync.Once
}

func newTerminalSizeQueue() *terminalSizeQueue {
	return &terminalSizeQueue{ch: make(chan remotecommand.TerminalSize, 4)}
}

func (q *terminalSizeQueue) Next() *remotecommand.TerminalSize {
	s, ok := <-q.ch
	if !ok {
		return nil
	}
	return &s
}

func (q *terminalSizeQueue) Push(cols, rows uint16) {
	if q == nil {
		return
	}
	select {
	case q.ch <- remotecommand.TerminalSize{Width: cols, Height: rows}:
	default:
		// drop if buffer full to avoid blocking
	}
}

func (q *terminalSizeQueue) Close() {
	if q == nil {
		return
	}
	q.once.Do(func() { close(q.ch) })
}

var shellSessions sync.Map // sessionID -> *ShellSession

func termOutputEvent(sessionID string) string { return fmt.Sprintf("terminal:%s:output", sessionID) }
func termExitEvent(sessionID string) string   { return fmt.Sprintf("terminal:%s:exit", sessionID) }

// StartShellSession starts a local shell (cmd.exe or bash) with PTY for xterm.js
func (a *App) StartShellSession(sessionID, shellCmd string) error {
	ctx, cancel := context.WithCancel(context.Background())
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmdPath := os.Getenv("ComSpec")
		if cmdPath == "" {
			cmdPath = `C:\\Windows\\System32\\cmd.exe`
		}
		cmd = exec.CommandContext(ctx, cmdPath)
	} else {
		cmd = exec.CommandContext(ctx, "bash", "-i")
	}
	ptyFile, err := pty.Start(cmd)
	if err != nil {
		cancel()
		return err
	}
	shellSessions.Store(sessionID, &ShellSession{Cmd: cmd, PTY: ptyFile, Cancel: cancel})
	// stream output to per-session event
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptyFile.Read(buf)
			if n > 0 {
				wailsRuntime.EventsEmit(a.ctx, termOutputEvent(sessionID), string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
		wailsRuntime.EventsEmit(a.ctx, termExitEvent(sessionID), "[session closed]")
	}()
	// Optionally send initial command
	if shellCmd != "" {
		_, _ = ptyFile.Write([]byte(shellCmd + "\r\n"))
	}
	return nil
}

// StartPodExecSession starts an in-cluster exec shell in a pod with TTY for xterm.js
// This implementation uses client-go SPDY executor for robustness and cross-platform support.
func (a *App) StartPodExecSession(sessionID, namespace, podName, shell string) error {
	if namespace == "" {
		if a.currentNamespace == "" {
			return fmt.Errorf("no namespace selected")
		}
		namespace = a.currentNamespace
	}
	configPath := a.getKubeConfigPath()
	cfg, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return err
	}
	if a.currentKubeContext == "" {
		return fmt.Errorf("no kube context selected")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*cfg, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return err
	}
	if shell == "" || shell == "auto" {
		shell = "/bin/bash"
	}
	ctx, cancel := context.WithCancel(context.Background())

	// stdin pipe for feeding user input
	pr, pw := io.Pipe()

	// size queue for TTY resize
	sizeQ := newTerminalSizeQueue()

	// prepare initial command
	execReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(namespace).Name(podName).SubResource("exec")
	// We'll start with requested shell, fallback will be handled by re-running on error
	execOptions := &v1.PodExecOptions{
		Stdin:  true,
		Stdout: true,
		Stderr: true,
		TTY:    true,
		Command: []string{
			shell,
		},
	}
	execReq = execReq.VersionedParams(execOptions, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", execReq.URL())
	if err != nil {
		cancel()
		return err
	}

	// register session before starting streams
	sess := &ShellSession{Cancel: cancel, Stdin: pw, SizeQ: sizeQ}
	shellSessions.Store(sessionID, sess)

	// stdout/err writers emitting to event
	stdoutWriter := &eventWriter{app: a, sessionID: sessionID}
	stderrWriter := &eventWriter{app: a, sessionID: sessionID}

	go func() {
		defer func() {
			// on exit
			wailsRuntime.EventsEmit(a.ctx, termExitEvent(sessionID), "[session closed]")
		}()
		// stream until completion or cancel
		streamErr := exec.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:             pr,
			Stdout:            stdoutWriter,
			Stderr:            stderrWriter,
			TerminalSizeQueue: sizeQ,
			Tty:               true,
		})
		if streamErr != nil && ctx.Err() == nil {
			// try fallback to /bin/sh if bash failed
			if shell != "/bin/sh" {
				fallbackReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(namespace).Name(podName).SubResource("exec")
				fallbackOpts := &v1.PodExecOptions{Stdin: true, Stdout: true, Stderr: true, TTY: true, Command: []string{"/bin/sh"}}
				fallbackReq = fallbackReq.VersionedParams(fallbackOpts, scheme.ParameterCodec)
				if fallbackExec, err2 := remotecommand.NewSPDYExecutor(restConfig, "POST", fallbackReq.URL()); err2 == nil {
					_, _ = stdoutWriter.Write([]byte("[fallback to /bin/sh]\r\n"))
					_ = fallbackExec.StreamWithContext(ctx, remotecommand.StreamOptions{
						Stdin:             pr,
						Stdout:            stdoutWriter,
						Stderr:            stderrWriter,
						TerminalSizeQueue: sizeQ,
						Tty:               true,
					})
				}
			}
		}
	}()

	return nil
}

// eventWriter writes stream data to a per-session Wails event

type eventWriter struct {
	app       *App
	sessionID string
}

func (w *eventWriter) Write(p []byte) (int, error) {
	wailsRuntime.EventsEmit(w.app.ctx, termOutputEvent(w.sessionID), string(p))
	return len(p), nil
}

// SendShellInput writes input to the shell or pod exec session
func (a *App) SendShellInput(sessionID, input string) error {
	v, ok := shellSessions.Load(sessionID)
	if !ok {
		return fmt.Errorf("session not found")
	}
	sess := v.(*ShellSession)
	if sess.PTY != nil {
		_, err := sess.PTY.Write([]byte(input))
		return err
	}
	if sess.Stdin != nil {
		_, err := sess.Stdin.Write([]byte(input))
		return err
	}
	return fmt.Errorf("no input stream available")
}

// ResizeShellSession resizes the underlying PTY or remote TTY
func (a *App) ResizeShellSession(sessionID string, cols, rows int) error {
	v, ok := shellSessions.Load(sessionID)
	if !ok {
		return fmt.Errorf("session not found")
	}
	sess := v.(*ShellSession)
	if sess.PTY != nil {
		// local PTY resize requires *os.File
		if f, ok := sess.PTY.(*os.File); ok {
			return pty.Setsize(f, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
		}
		return nil
	}
	if sess.SizeQ != nil {
		sess.SizeQ.Push(uint16(cols), uint16(rows))
		return nil
	}
	return nil
}

// StopShellSession terminates the shell or pod exec session
func (a *App) StopShellSession(sessionID string) error {
	v, ok := shellSessions.Load(sessionID)
	if !ok {
		return fmt.Errorf("session not found")
	}
	sess := v.(*ShellSession)
	if sess.Cancel != nil {
		sess.Cancel()
	}
	if sess.SizeQ != nil {
		sess.SizeQ.Close()
	}
	if sess.PTY != nil {
		_ = sess.PTY.Close()
	}
	if sess.Stdin != nil {
		_ = sess.Stdin.Close()
	}
	if sess.Cmd != nil && sess.Cmd.Process != nil {
		_ = sess.Cmd.Process.Kill()
	}
	shellSessions.Delete(sessionID)
	return nil
}

// GetRunningPods returns all running pods (name, restarts, uptime) in a namespace
func (a *App) GetRunningPods(namespace string) ([]PodInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	var result []PodInfo
	now := time.Now()
	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" {
			uptime := "-"
			startTimeStr := ""
			if pod.Status.StartTime != nil {
				dur := now.Sub(pod.Status.StartTime.Time)
				uptime = dur.Truncate(time.Second).String()
				startTimeStr = pod.Status.StartTime.Time.UTC().Format(time.RFC3339)
			}
			restarts := int32(0)
			if pod.Status.ContainerStatuses != nil {
				for _, cs := range pod.Status.ContainerStatuses {
					restarts += cs.RestartCount
				}
			}
			result = append(result, PodInfo{Name: pod.Name, Restarts: restarts, Uptime: uptime, StartTime: startTimeStr})
		}
	}
	return result, nil
}

// StartPodPolling emits pods:update events every second with the current pod list
func (a *App) StartPodPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil || a.currentNamespace == "" {
				continue
			}
			pods, err := a.GetRunningPods(a.currentNamespace)
			if err == nil {
				wailsRuntime.EventsEmit(a.ctx, "pods:update", pods)
			}
		}
	}()
}

// RestartPod restarts a pod by deleting it (Kubernetes will recreate it if part of a deployment)
func (a *App) RestartPod(namespace, podName string) error {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.BuildConfigFromFlags("", configPath)
	if err != nil {
		return err
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return err
	}
	return clientset.CoreV1().Pods(namespace).Delete(a.ctx, podName, metav1.DeleteOptions{})
}

// ShellPod returns a kubectl command for shell access to the pod
func (a *App) ShellPod(namespace, podName string) (string, error) {
	// Try /bin/bash first, fallback to /bin/sh
	return fmt.Sprintf("kubectl -n %s exec -i %s -- /bin/bash || kubectl -n %s exec -i %s -- /bin/sh", namespace, podName, namespace, podName), nil
}

// PortForwardPod returns a kubectl command for port-forwarding the pod
func (a *App) PortForwardPod(namespace, podName string, port int) (string, error) {
	return fmt.Sprintf("kubectl -n %s port-forward pod/%s %d:%d", namespace, podName, port, port), nil
}

// DeletePod deletes a pod
func (a *App) DeletePod(namespace, podName string) error {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.BuildConfigFromFlags("", configPath)
	if err != nil {
		return err
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return err
	}
	return clientset.CoreV1().Pods(namespace).Delete(a.ctx, podName, metav1.DeleteOptions{})
}

// ExecCommand runs a shell command and streams output via Wails events
func (a *App) ExecCommand(cmdline string) error {
	ctx := a.ctx
	cmd := exec.CommandContext(ctx, "bash", "-c", cmdline)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			wailsRuntime.EventsEmit(ctx, "console:output", scanner.Text())
		}
	}()
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			wailsRuntime.EventsEmit(ctx, "console:output", scanner.Text())
		}
	}()
	cmd.Wait()
	return nil
}
