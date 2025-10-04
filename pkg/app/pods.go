package app

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
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
	if a.currentKubeContext == "" {
		return fmt.Errorf("no kube context selected")
	}
	// obtain rest.Config with insecure fallback capability
	restConfig, err := a.getRESTConfig()
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

	executor, err := remotecommand.NewSPDYExecutor(restConfig, "POST", execReq.URL())
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
		streamErr := executor.StreamWithContext(ctx, remotecommand.StreamOptions{
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

// PortForwardSession manages a kubectl port-forward session
type PortForwardSession struct {
	Cmd    *exec.Cmd
	Cancel context.CancelFunc
}

var portForwardSessions sync.Map // key -> *PortForwardSession

// portForwardKey returns a key for same local & remote port (backward compatibility)
func portForwardKey(ns, pod string, port int) string { return portForwardKeyLR(ns, pod, port, port) }

func portForwardKeyLR(ns, pod string, local, remote int) string {
	return fmt.Sprintf("%s/%s:%d:%d", ns, pod, local, remote)
}

// emitPortForwardsUpdate emits a snapshot of all active port forward sessions
func (a *App) emitPortForwardsUpdate() {
	var list []PortForwardInfo
	portForwardSessions.Range(func(k, v any) bool {
		ks, _ := k.(string)
		// format ns/pod:local:remote
		parts := strings.Split(ks, ":")
		if len(parts) != 3 {
			return true
		}
		// split ns/pod
		left := parts[0]
		lr := parts[1:]
		p := strings.SplitN(left, "/", 2)
		if len(p) != 2 {
			return true
		}
		local, _ := strconv.Atoi(lr[0])
		remote, _ := strconv.Atoi(lr[1])
		list = append(list, PortForwardInfo{Namespace: p[0], Pod: p[1], Local: local, Remote: remote})
		return true
	})
	wailsRuntime.EventsEmit(a.ctx, "portforwards:update", list)
}

// ListPortForwards returns current active port forward sessions
func (a *App) ListPortForwards() ([]PortForwardInfo, error) {
	var list []PortForwardInfo
	portForwardSessions.Range(func(k, v any) bool {
		ks, _ := k.(string)
		parts := strings.Split(ks, ":")
		if len(parts) != 3 {
			return true
		}
		left := parts[0]
		lr := parts[1:]
		p := strings.SplitN(left, "/", 2)
		if len(p) != 2 {
			return true
		}
		local, _ := strconv.Atoi(lr[0])
		remote, _ := strconv.Atoi(lr[1])
		list = append(list, PortForwardInfo{Namespace: p[0], Pod: p[1], Local: local, Remote: remote})
		return true
	})
	return list, nil
}

// PortForwardPod starts a kubectl port-forward process using same local and remote port
func (a *App) PortForwardPod(namespace, podName string, port int) (string, error) {
	return a.PortForwardPodWith(namespace, podName, port, port)
}

// PortForwardPodWith starts a kubectl port-forward process with explicit local and remote ports and returns the local URL
func (a *App) PortForwardPodWith(namespace, podName string, localPort, remotePort int) (string, error) {
	if namespace == "" {
		if a.currentNamespace == "" {
			return "", fmt.Errorf("no namespace selected")
		}
		namespace = a.currentNamespace
	}
	if podName == "" {
		return "", fmt.Errorf("pod name required")
	}
	if localPort <= 0 || localPort > 65535 || remotePort <= 0 || remotePort > 65535 {
		return "", fmt.Errorf("invalid ports: local=%d remote=%d", localPort, remotePort)
	}
	key := portForwardKeyLR(namespace, podName, localPort, remotePort)
	if _, exists := portForwardSessions.Load(key); exists {
		wailsRuntime.EventsEmit(a.ctx, "portforward:"+key+":ready", localPort)
		// also update snapshot
		a.emitPortForwardsUpdate()
		return fmt.Sprintf("http://127.0.0.1:%d", localPort), nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	kubectl := "kubectl"
	if runtime.GOOS == "windows" {
		kubectl = "kubectl.exe"
	}
	args := []string{}
	if cfg := a.getKubeConfigPath(); cfg != "" {
		args = append(args, "--kubeconfig", cfg)
	}
	if a.currentKubeContext != "" {
		args = append(args, "--context", a.currentKubeContext)
	}
	args = append(args, "-n", namespace, "port-forward", "pod/"+podName, fmt.Sprintf("%d:%d", localPort, remotePort))
	cmd := exec.CommandContext(ctx, kubectl, args...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return "", err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return "", err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return "", err
	}

	sess := &PortForwardSession{Cmd: cmd, Cancel: cancel}
	portForwardSessions.Store(key, sess)
	// emit snapshot after storing
	a.emitPortForwardsUpdate()

	// Stream output and emit readiness/error/exit events
	go func() {
		defer func() {
			_ = cmd.Wait()
			wailsRuntime.EventsEmit(a.ctx, "portforward:"+key+":exit", 0)
			portForwardSessions.Delete(key)
			// emit snapshot after removal
			a.emitPortForwardsUpdate()
		}()

		readyEmitted := false
		emitLine := func(line string) {
			wailsRuntime.EventsEmit(a.ctx, "portforward:"+key+":output", line)
			if !readyEmitted {
				if strings.Contains(line, fmt.Sprintf("Forwarding from 127.0.0.1:%d", localPort)) || strings.Contains(line, fmt.Sprintf("Forwarding from [::1]:%d", localPort)) || strings.Contains(line, fmt.Sprintf("Forwarding from localhost:%d", localPort)) || strings.Contains(line, fmt.Sprintf("Forwarding from 0.0.0.0:%d", localPort)) {
					readyEmitted = true
					wailsRuntime.EventsEmit(a.ctx, "portforward:"+key+":ready", localPort)
				}
			}
		}
		stdoutScanner := bufio.NewScanner(stdout)
		stderrScanner := bufio.NewScanner(stderr)
		stdoutDone := make(chan struct{})
		stderrDone := make(chan struct{})
		go func() {
			for stdoutScanner.Scan() {
				emitLine(stdoutScanner.Text())
			}
			stdoutDone <- struct{}{}
		}()
		go func() {
			for stderrScanner.Scan() {
				emitLine(stderrScanner.Text())
			}
			stderrDone <- struct{}{}
		}()
		<-stdoutDone
		<-stderrDone
		if err := stdoutScanner.Err(); err != nil {
			wailsRuntime.EventsEmit(a.ctx, "portforward:"+key+":error", err.Error())
		}
		if err := stderrScanner.Err(); err != nil {
			wailsRuntime.EventsEmit(a.ctx, "portforward:"+key+":error", err.Error())
		}
	}()

	return fmt.Sprintf("http://127.0.0.1:%d", localPort), nil
}

// StopPortForward stops an active port-forward session for the given pod by local port
func (a *App) StopPortForward(namespace, podName string, localPort int) error {
	if namespace == "" {
		namespace = a.currentNamespace
	}
	// Try exact same-port key for backward compatibility
	keySame := portForwardKey(namespace, podName, localPort)
	if v, ok := portForwardSessions.Load(keySame); ok {
		sess := v.(*PortForwardSession)
		if sess.Cancel != nil {
			sess.Cancel()
		}
		if sess.Cmd != nil && sess.Cmd.Process != nil {
			_ = sess.Cmd.Process.Kill()
		}
		portForwardSessions.Delete(keySame)
		// emit snapshot after stop
		a.emitPortForwardsUpdate()
		return nil
	}
	// Otherwise, find any session for ns/pod with matching local port
	prefix := fmt.Sprintf("%s/%s:", namespace, podName)
	var foundKey string
	portForwardSessions.Range(func(k, v any) bool {
		ks, _ := k.(string)
		if !strings.HasPrefix(ks, prefix) {
			return true
		}
		// format ns/pod:local:remote
		parts := strings.Split(ks[len(prefix):], ":")
		if len(parts) == 2 {
			if lp, err := strconv.Atoi(parts[0]); err == nil && lp == localPort {
				foundKey = ks
				return false
			}
		}
		return true
	})
	if foundKey == "" {
		return fmt.Errorf("no port-forward running for %s on local %d", prefix[:len(prefix)-1], localPort)
	}
	if v, ok := portForwardSessions.Load(foundKey); ok {
		sess := v.(*PortForwardSession)
		if sess.Cancel != nil {
			sess.Cancel()
		}
		if sess.Cmd != nil && sess.Cmd.Process != nil {
			_ = sess.Cmd.Process.Kill()
		}
		portForwardSessions.Delete(foundKey)
		// emit snapshot after stop
		a.emitPortForwardsUpdate()
		return nil
	}
	return fmt.Errorf("session disappeared for %s", foundKey)
}

// GetRunningPods returns all running pods (name, restarts, uptime) in a namespace
func (a *App) GetRunningPods(namespace string) ([]PodInfo, error) {
	clientset, err := a.createKubernetesClient()
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
		isJobPod := false
		for _, owner := range pod.OwnerReferences {
			if owner.Kind == "Job" {
				isJobPod = true
				break
			}
		}
		if pod.Status.Phase == "Running" || isJobPod {
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
			// collect unique container ports across all containers
			portSet := make(map[int]struct{})
			for _, c := range pod.Spec.Containers {
				for _, p := range c.Ports {
					if p.ContainerPort > 0 {
						portSet[int(p.ContainerPort)] = struct{}{}
					}
				}
			}
			var ports []int
			for v := range portSet {
				ports = append(ports, v)
			}
			result = append(result, PodInfo{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Restarts:  restarts,
				Uptime:    uptime,
				StartTime: startTimeStr,
				Ports:     ports,
				Status:    string(pod.Status.Phase),
			})
		}
	}
	return result, nil
}

// StartPodPolling emits pods:update events every second with the current pod list
func (a *App) StartPodPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			// Determine namespaces to poll
			nsList := a.preferredNamespaces
			if len(nsList) == 0 && a.currentNamespace != "" {
				nsList = []string{a.currentNamespace}
			}
			if len(nsList) == 0 {
				continue
			}
			var all []PodInfo
			for _, ns := range nsList {
				pods, err := a.GetRunningPods(ns)
				if err != nil {
					continue
				}
				all = append(all, pods...)
			}
			wailsRuntime.EventsEmit(a.ctx, "pods:update", all)
		}
	}()
}

// RestartPod restarts a pod by deleting it (Kubernetes will recreate it if part of a deployment)
func (a *App) RestartPod(namespace, podName string) error {
	clientset, err := a.createKubernetesClient()
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

// DeletePod deletes a pod
func (a *App) DeletePod(namespace, podName string) error {
	clientset, err := a.createKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().Pods(namespace).Delete(a.ctx, podName, metav1.DeleteOptions{})
}

// ExecCommand runs a shell command and streams output via Wails events
func (a *App) ExecCommand(cmdline string) error {
	ctx := a.ctx
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		comspec := os.Getenv("ComSpec")
		if comspec == "" {
			comspec = `C:\\Windows\\System32\\cmd.exe`
		}
		cmd = exec.CommandContext(ctx, comspec, "/C", cmdline)
	} else {
		cmd = exec.CommandContext(ctx, "bash", "-c", cmdline)
	}
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
	return cmd.Wait()
}

// GetPodStatusCounts returns counts of pods by phase for the given namespace
func (a *App) GetPodStatusCounts(namespace string) (PodStatusCounts, error) {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return PodStatusCounts{}, err
	}
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return PodStatusCounts{}, err
	}
	var counts PodStatusCounts
	counts.Total = len(pods.Items)
	for _, pod := range pods.Items {
		switch pod.Status.Phase {
		case v1.PodRunning:
			counts.Running++
		case v1.PodPending:
			counts.Pending++
		case v1.PodFailed:
			counts.Failed++
		case v1.PodSucceeded:
			counts.Succeeded++
		default:
			counts.Unknown++
		}
	}
	return counts, nil
}
