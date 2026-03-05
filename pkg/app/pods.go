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

	"gowails/pkg/logger"

	"github.com/creack/pty"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	restclient "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

// ShellSession manages a shell or pod exec session
// Supports local shell (cmd/bash) and in-cluster exec with PTY
// Streams output to frontend and accepts input
// Robust session management

type ShellSession struct {
	Cmd          *exec.Cmd
	PTY          io.ReadWriteCloser // PTY for interactive local shell
	Stdin        io.WriteCloser     // For in-cluster exec or non-PTY shells
	Cancel       context.CancelFunc // For stopping session
	SizeQ        *terminalSizeQueue // For in-cluster exec resize handling
	ResizeFn     func(cols, rows int) error
	LastActivity time.Time // last time input/output was observed (SUG-3)
}

const (
	// shellSessionIdleTimeout is the maximum time a shell session can be idle
	// before being automatically reaped (SUG-3).
	shellSessionIdleTimeout = 30 * time.Minute
	// shellSessionReaperInterval is how often the reaper checks for idle sessions.
	shellSessionReaperInterval = 60 * time.Second
	// maxShellSessions is the maximum number of concurrent shell sessions allowed (SUG-3).
	maxShellSessions = 20
)

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

func safeUint16FromInt(v int) (uint16, error) {
	maxUint16 := int(^uint16(0))
	if v < 0 || v > maxUint16 {
		return 0, fmt.Errorf("value out of range: %d", v)
	}
	return uint16(v), nil
}

var shellSessions sync.Map // sessionID -> *ShellSession

func termOutputEvent(sessionID string) string { return TerminalOutputEvent(sessionID) }
func termExitEvent(sessionID string) string   { return TerminalExitEvent(sessionID) }

// shellSessionCount returns the current number of active sessions in the map.
func shellSessionCount() int {
	count := 0
	shellSessions.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	return count
}

// touchSession updates the LastActivity timestamp for the given session.
func touchSession(sessionID string) {
	if v, ok := shellSessions.Load(sessionID); ok {
		sess := v.(*ShellSession)
		sess.LastActivity = time.Now()
	}
}

// startShellSessionReaper starts a background goroutine that periodically
// removes idle shell sessions (SUG-3). It stops when ctx is cancelled.
func (a *App) startShellSessionReaper(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(shellSessionReaperInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				now := time.Now()
				shellSessions.Range(func(key, value interface{}) bool {
					sess := value.(*ShellSession)
					if now.Sub(sess.LastActivity) > shellSessionIdleTimeout {
						logger.Info("reaping idle shell session", "sessionID", key)
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
						shellSessions.Delete(key)
					}
					return true
				})
			}
		}
	}()
}

// StartShellSession starts a local shell (cmd.exe or bash) with PTY for xterm.js
func (a *App) StartShellSession(sessionID, shellCmd string) error {
	if shellSessionCount() >= maxShellSessions {
		return fmt.Errorf("maximum number of shell sessions (%d) reached", maxShellSessions)
	}
	ctx, cancel := context.WithCancel(context.Background())
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmdPath := os.Getenv("ComSpec")
		if cmdPath == "" {
			cmdPath = `C:\\Windows\\System32\\cmd.exe`
		}
		// #nosec G204 -- user-initiated local shell session.
		cmd = exec.CommandContext(ctx, cmdPath)
	} else {
		// #nosec G204 -- user-initiated local shell session.
		cmd = exec.CommandContext(ctx, "bash", "-i")
	}
	ptyFile, err := pty.Start(cmd)
	if err != nil {
		cancel()
		return err
	}
	shellSessions.Store(sessionID, &ShellSession{Cmd: cmd, PTY: ptyFile, Cancel: cancel, LastActivity: time.Now()})
	// stream output to per-session event
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptyFile.Read(buf)
			if n > 0 {
				touchSession(sessionID)
				emitEvent(a.ctx, termOutputEvent(sessionID), string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
		emitEvent(a.ctx, termExitEvent(sessionID), "[session closed]")
		shellSessions.Delete(sessionID) // cleanup leaked entry (SUG-3)
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
	if shellSessionCount() >= maxShellSessions {
		return fmt.Errorf("maximum number of shell sessions (%d) reached", maxShellSessions)
	}
	if namespace == "" {
		if a.currentNamespace == "" {
			return fmt.Errorf("no namespace selected")
		}
		namespace = a.currentNamespace
	}
	if a.currentKubeContext == "" {
		return fmt.Errorf("no kube context selected")
	}
	restConfig, err := a.getRESTConfig()
	if err != nil {
		return err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return err
	}
	if shell == "" || shell == "auto" {
		shell = "/bin/sh"
	}
	ctx, cancel := context.WithCancel(context.Background())

	pr, pw := io.Pipe()
	sizeQ := newTerminalSizeQueue()

	executor, err := createPodExecutor(clientset, restConfig, namespace, podName, shell)
	if err != nil {
		cancel()
		return err
	}

	sess := &ShellSession{Cancel: cancel, Stdin: pw, SizeQ: sizeQ, LastActivity: time.Now()}
	shellSessions.Store(sessionID, sess)

	stdoutWriter := &eventWriter{app: a, sessionID: sessionID}
	stderrWriter := &eventWriter{app: a, sessionID: sessionID}
	streamOpts := remotecommand.StreamOptions{
		Stdin: pr, Stdout: stdoutWriter, Stderr: stderrWriter,
		TerminalSizeQueue: sizeQ, Tty: true,
	}

	go func() {
		defer func() {
			emitEvent(a.ctx, termExitEvent(sessionID), "[session closed]")
			shellSessions.Delete(sessionID) // cleanup leaked entry (SUG-3)
		}()
		streamErr := executor.StreamWithContext(ctx, streamOpts)
		if streamErr != nil && ctx.Err() == nil && shell != "/bin/sh" {
			a.tryShellFallback(ctx, clientset, restConfig, namespace, podName, streamOpts, stdoutWriter)
		}
	}()

	return nil
}

// createPodExecutor creates an SPDY executor for pod exec.
func createPodExecutor(clientset *kubernetes.Clientset, restConfig interface{}, namespace, podName, shell string) (remotecommand.Executor, error) {
	execReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(namespace).Name(podName).SubResource("exec")
	execOptions := &v1.PodExecOptions{
		Stdin: true, Stdout: true, Stderr: true, TTY: true,
		Command: []string{shell},
	}
	execReq = execReq.VersionedParams(execOptions, scheme.ParameterCodec)
	// Note: restConfig needs to be *rest.Config but type assertion handled by caller
	return remotecommand.NewSPDYExecutor(restConfig.(*restclient.Config), "POST", execReq.URL())
}

// tryShellFallback attempts /bin/sh if the primary shell failed.
func (a *App) tryShellFallback(ctx context.Context, clientset *kubernetes.Clientset, restConfig interface{}, namespace, podName string, streamOpts remotecommand.StreamOptions, stdoutWriter io.Writer) {
	fallbackExec, err := createPodExecutor(clientset, restConfig, namespace, podName, "/bin/sh")
	if err != nil {
		return
	}
	_, _ = stdoutWriter.Write([]byte("[fallback to /bin/sh]\r\n"))
	_ = fallbackExec.StreamWithContext(ctx, streamOpts)
}

// eventWriter writes stream data to a per-session Wails event

type eventWriter struct {
	app       *App
	sessionID string
}

func (w *eventWriter) Write(p []byte) (int, error) {
	touchSession(w.sessionID)
	emitEvent(w.app.ctx, termOutputEvent(w.sessionID), string(p))
	return len(p), nil
}

// SendShellInput writes input to the shell or pod exec session
func (a *App) SendShellInput(sessionID, input string) error {
	v, ok := shellSessions.Load(sessionID)
	if !ok {
		return fmt.Errorf("session not found")
	}
	sess := v.(*ShellSession)
	sess.LastActivity = time.Now() // keep session alive on input (SUG-3)
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
	cols16, err := safeUint16FromInt(cols)
	if err != nil {
		return err
	}
	rows16, err := safeUint16FromInt(rows)
	if err != nil {
		return err
	}
	sess := v.(*ShellSession)
	if sess.PTY != nil {
		// local PTY resize requires *os.File
		if f, ok := sess.PTY.(*os.File); ok {
			return pty.Setsize(f, &pty.Winsize{Cols: cols16, Rows: rows16})
		}
		if sess.ResizeFn != nil {
			return sess.ResizeFn(cols, rows)
		}
		return nil
	}
	if sess.SizeQ != nil {
		sess.SizeQ.Push(cols16, rows16)
		return nil
	}
	if sess.ResizeFn != nil {
		return sess.ResizeFn(cols, rows)
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
	emitEvent(a.ctx, EventPortForwardsUpdate, list)
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

// validatePortForwardParams validates port-forward parameters
func (a *App) validatePortForwardParams(namespace, podName string, localPort, remotePort int) (string, error) {
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
	return namespace, nil
}

// buildKubectlCmd builds the kubectl port-forward command
func (a *App) buildKubectlCmd(ctx context.Context, namespace, podName string, localPort, remotePort int) *exec.Cmd {
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
	// #nosec G204 -- arguments are constructed, no shell used.
	return exec.CommandContext(ctx, kubectl, args...)
}

// checkForwardingReady checks if kubectl output indicates forwarding is ready
func checkForwardingReady(line string, localPort int) bool {
	checks := []string{
		fmt.Sprintf("Forwarding from 127.0.0.1:%d", localPort),
		fmt.Sprintf("Forwarding from [::1]:%d", localPort),
		fmt.Sprintf("Forwarding from localhost:%d", localPort),
		fmt.Sprintf("Forwarding from 0.0.0.0:%d", localPort),
	}
	for _, check := range checks {
		if strings.Contains(line, check) {
			return true
		}
	}
	return false
}

// streamPortForwardOutput streams output from kubectl port-forward
func (a *App) streamPortForwardOutput(cmd *exec.Cmd, stdout, stderr io.ReadCloser, key string, localPort int) {
	defer func() {
		_ = cmd.Wait()
		emitEvent(a.ctx, PortForwardEvent(key, "exit"), 0)
		portForwardSessions.Delete(key)
		a.emitPortForwardsUpdate()
	}()

	readyEmitted := false
	emitLine := func(line string) {
		emitEvent(a.ctx, PortForwardEvent(key, "output"), line)
		if !readyEmitted && checkForwardingReady(line, localPort) {
			readyEmitted = true
			emitEvent(a.ctx, PortForwardEvent(key, "ready"), localPort)
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
		emitEvent(a.ctx, PortForwardEvent(key, "error"), err.Error())
	}
	if err := stderrScanner.Err(); err != nil {
		emitEvent(a.ctx, PortForwardEvent(key, "error"), err.Error())
	}
}

// PortForwardPodWith starts a kubectl port-forward process with explicit local and remote ports and returns the local URL
func (a *App) PortForwardPodWith(namespace, podName string, localPort, remotePort int) (string, error) {
	namespace, err := a.validatePortForwardParams(namespace, podName, localPort, remotePort)
	if err != nil {
		return "", err
	}

	key := portForwardKeyLR(namespace, podName, localPort, remotePort)
	if _, exists := portForwardSessions.Load(key); exists {
		emitEvent(a.ctx, PortForwardEvent(key, "ready"), localPort)
		a.emitPortForwardsUpdate()
		return fmt.Sprintf("http://127.0.0.1:%d", localPort), nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := a.buildKubectlCmd(ctx, namespace, podName, localPort, remotePort)

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
	a.emitPortForwardsUpdate()

	go a.streamPortForwardOutput(cmd, stdout, stderr, key, localPort)

	return fmt.Sprintf("http://127.0.0.1:%d", localPort), nil
}

// terminatePortForwardSession stops and removes a port-forward session
func terminatePortForwardSession(sess *PortForwardSession, key string) {
	if sess.Cancel != nil {
		sess.Cancel()
	}
	if sess.Cmd != nil && sess.Cmd.Process != nil {
		_ = sess.Cmd.Process.Kill()
	}
	portForwardSessions.Delete(key)
}

// findPortForwardSessionKey finds a session key for ns/pod with matching local port
func findPortForwardSessionKey(namespace, podName string, localPort int) string {
	prefix := fmt.Sprintf("%s/%s:", namespace, podName)
	var foundKey string
	portForwardSessions.Range(func(k, v any) bool {
		ks, _ := k.(string)
		if !strings.HasPrefix(ks, prefix) {
			return true
		}
		parts := strings.Split(ks[len(prefix):], ":")
		if len(parts) == 2 {
			if lp, err := strconv.Atoi(parts[0]); err == nil && lp == localPort {
				foundKey = ks
				return false
			}
		}
		return true
	})
	return foundKey
}

// StopPortForward stops an active port-forward session for the given pod by local port
func (a *App) StopPortForward(namespace, podName string, localPort int) error {
	if namespace == "" {
		namespace = a.currentNamespace
	}
	// Try exact same-port key for backward compatibility
	keySame := portForwardKey(namespace, podName, localPort)
	if v, ok := portForwardSessions.Load(keySame); ok {
		terminatePortForwardSession(v.(*PortForwardSession), keySame)
		a.emitPortForwardsUpdate()
		return nil
	}
	// Otherwise, find any session for ns/pod with matching local port
	foundKey := findPortForwardSessionKey(namespace, podName, localPort)
	if foundKey == "" {
		return fmt.Errorf("no port-forward running for %s/%s on local %d", namespace, podName, localPort)
	}
	if v, ok := portForwardSessions.Load(foundKey); ok {
		terminatePortForwardSession(v.(*PortForwardSession), foundKey)
		a.emitPortForwardsUpdate()
		return nil
	}
	return fmt.Errorf("session disappeared for %s", foundKey)
}

// isJobOwnedPod checks if a pod is owned by a Job
func isJobOwnedPod(pod *v1.Pod) bool {
	for _, owner := range pod.OwnerReferences {
		if owner.Kind == "Job" {
			return true
		}
	}
	return false
}

// calculateRestarts sums restart counts from container statuses
func calculateRestarts(pod *v1.Pod) int32 {
	var restarts int32
	for _, cs := range pod.Status.ContainerStatuses {
		restarts += cs.RestartCount
	}
	return restarts
}

// collectContainerPorts extracts unique container ports from a pod
func collectContainerPorts(pod *v1.Pod) []int {
	portSet := make(map[int]struct{})
	for _, c := range pod.Spec.Containers {
		for _, p := range c.Ports {
			if p.ContainerPort > 0 {
				portSet[int(p.ContainerPort)] = struct{}{}
			}
		}
	}
	ports := make([]int, 0, len(portSet))
	for v := range portSet {
		ports = append(ports, v)
	}
	return ports
}

// buildPodInfoFromPod creates a PodInfo from a pod
func buildPodInfoFromPod(pod v1.Pod, now time.Time) PodInfo {
	uptime := "-"
	startTimeStr := ""
	if pod.Status.StartTime != nil {
		dur := now.Sub(pod.Status.StartTime.Time)
		uptime = dur.Truncate(time.Second).String()
		startTimeStr = pod.Status.StartTime.Time.UTC().Format(time.RFC3339)
	}
	return PodInfo{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Restarts:  calculateRestarts(&pod),
		Uptime:    uptime,
		StartTime: startTimeStr,
		Ports:     collectContainerPorts(&pod),
		Status:    string(pod.Status.Phase),
		UID:       string(pod.UID),
	}
}

// shouldIncludePod determines if a pod should be included in running pods list
func shouldIncludePod(pod *v1.Pod) bool {
	if pod.Status.Phase == v1.PodRunning || pod.Status.Phase == v1.PodPending {
		return true
	}
	return isJobOwnedPod(pod)
}

// GetRunningPods returns all running (and pending) pods (name, restarts, uptime) in a namespace
// Pending pods are included so the UI can show pods while they are in 'Creating' state.
func (a *App) GetRunningPods(namespace string) ([]PodInfo, error) {
	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		pods, err := factory.Core().V1().Pods().Lister().Pods(namespace).List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]PodInfo, 0, len(pods))
			for _, pod := range pods {
				if shouldIncludePod(pod) {
					copyPod := *pod
					result = append(result, buildPodInfoFromPod(copyPod, now))
				}
			}
			return result, nil
		}
	}

	clientset, err := a.getClient()
	if err != nil {
		return nil, err
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]PodInfo, 0, len(pods.Items))
	for _, pod := range pods.Items {
		if shouldIncludePod(&pod) {
			result = append(result, buildPodInfoFromPod(pod, now))
		}
	}
	return result, nil
}

// RestartPod restarts a pod by deleting it (Kubernetes will recreate it if part of a deployment)
func (a *App) RestartPod(namespace, podName string) error {
	clientset, err := a.getKubernetesInterface()
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
	clientset, err := a.getKubernetesInterface()
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
		// #nosec G204 -- user-initiated command execution.
		cmd = exec.CommandContext(ctx, comspec, "/C", cmdline)
	} else {
		// #nosec G204 -- user-initiated command execution.
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
			emitEvent(ctx, EventConsoleOutput, scanner.Text())
		}
	}()
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			emitEvent(ctx, EventConsoleOutput, scanner.Text())
		}
	}()
	return cmd.Wait()
}

// GetPodStatusCounts returns counts of pods by phase for the given namespace
func (a *App) GetPodStatusCounts(namespace string) (PodStatusCounts, error) {
	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		pods, err := factory.Core().V1().Pods().Lister().Pods(namespace).List(labels.Everything())
		if err == nil {
			var counts PodStatusCounts
			counts.Total = len(pods)
			for _, pod := range pods {
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
	}

	clientset, err := a.getClient()
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
