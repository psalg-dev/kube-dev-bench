package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"reflect"
	"strings"
	"time"

	"github.com/moby/moby/client"
)

type swarmExecClient interface {
	TaskInspect(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error)
	ExecCreate(context.Context, string, client.ExecCreateOptions) (client.ExecCreateResult, error)
	ExecAttach(context.Context, string, client.ExecAttachOptions) (client.ExecAttachResult, error)
	ExecInspect(context.Context, string, client.ExecInspectOptions) (client.ExecInspectResult, error)
	ExecResize(context.Context, string, client.ExecResizeOptions) (client.ExecResizeResult, error)
}

// StartSwarmTaskExecSession starts an interactive shell in the container backing a Swarm task.
// It reuses the same terminal session event protocol as StartShellSession / StartPodExecSession:
// - Emits output to `terminal:{sessionID}:output`
// - Emits close message to `terminal:{sessionID}:exit`
// Input/resize/stop are handled via SendShellInput / ResizeShellSession / StopShellSession.
func (a *App) StartSwarmTaskExecSession(sessionID, taskID, shell string) error {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return a.startSwarmTaskExecSessionWithClient(ctx, cli, sessionID, taskID, shell)
}

// validateSwarmExecParams checks required parameters for exec session
func validateSwarmExecParams(cli swarmExecClient, sessionID, taskID string) error {
	if sessionID == "" {
		return fmt.Errorf("sessionID is required")
	}
	if taskID == "" {
		return fmt.Errorf("taskID is required")
	}
	if cli == nil {
		return fmt.Errorf("docker client is nil")
	}
	if v := reflect.ValueOf(cli); v.Kind() == reflect.Ptr && v.IsNil() {
		return fmt.Errorf("docker client is nil")
	}
	return nil
}

// getShellCandidates returns shell candidates to try
func getShellCandidates(shell string) []string {
	if shell == "" || shell == "auto" {
		return []string{"/bin/sh", "sh", "/bin/bash", "bash"}
	}
	return []string{shell}
}

// getTaskContainerID extracts container ID from a task
func getTaskContainerID(ctx context.Context, cli swarmExecClient, taskID string) (string, error) {
	taskResult, err := cli.TaskInspect(ctx, taskID, client.TaskInspectOptions{})
	if err != nil {
		return "", err
	}
	task := taskResult.Task
	if err != nil {
		return "", err
	}
	if task.Status.ContainerStatus == nil || task.Status.ContainerStatus.ContainerID == "" {
		return "", fmt.Errorf("task has no container yet")
	}
	return task.Status.ContainerStatus.ContainerID, nil
}

// tryAttachShell attempts to attach to container with shell candidates
func (a *App) tryAttachShell(sessCtx context.Context, cli swarmExecClient, containerID, sessionID, shell string, candidates []string) (attach client.ExecAttachResult, execID string, initial []byte, err error) {
	for i, candidate := range candidates {
		attach, execID, initial, err = swarmExecAttachTTYWithProbe(sessCtx, cli, containerID, candidate)
		if err == nil {
			if (shell == "" || shell == "auto") && i > 0 {
				emitEvent(a.ctx, termOutputEvent(sessionID), fmt.Sprintf("[fallback to %s]\r\n", candidate))
			}
			return attach, execID, initial, nil
		}
	}
	return client.ExecAttachResult{}, "", nil, err
}

// createSwarmShellSession creates and registers a shell session
func (a *App) createSwarmShellSession(sessCtx context.Context, cancel context.CancelFunc, cli swarmExecClient, attach client.ExecAttachResult, execID, sessionID string, initial []byte) {
	sess := &ShellSession{
		Cancel: cancel,
		PTY:    attach.Conn,
		ResizeFn: func(cols, rows int) error {
			if cols <= 0 || rows <= 0 {
				return nil
			}
			_, err := cli.ExecResize(sessCtx, execID, client.ExecResizeOptions{Width: uint(cols), Height: uint(rows)})
			return err
		},
	}
	shellSessions.Store(sessionID, sess)

	var reader io.Reader = attach.Reader
	if len(initial) > 0 {
		reader = io.MultiReader(bytes.NewReader(initial), attach.Reader)
	}

	go a.streamSwarmExecOutput(sessCtx, reader, attach, sessionID)
}

// streamSwarmExecOutput reads and emits output from the exec session
func (a *App) streamSwarmExecOutput(sessCtx context.Context, reader io.Reader, attach client.ExecAttachResult, sessionID string) {
	defer func() {
		emitEvent(a.ctx, termExitEvent(sessionID), "[session closed]")
	}()
	defer attach.Close()

	buf := make([]byte, 4096)
	for {
		n, rerr := reader.Read(buf)
		if n > 0 {
			emitEvent(a.ctx, termOutputEvent(sessionID), string(buf[:n]))
		}
		if rerr != nil {
			return
		}
		select {
		case <-sessCtx.Done():
			return
		default:
		}
	}
}

func (a *App) startSwarmTaskExecSessionWithClient(parentCtx context.Context, cli swarmExecClient, sessionID, taskID, shell string) error {
	if err := validateSwarmExecParams(cli, sessionID, taskID); err != nil {
		return err
	}

	containerID, err := getTaskContainerID(parentCtx, cli, taskID)
	if err != nil {
		return err
	}

	sessCtx, cancel := context.WithCancel(context.Background())

	candidates := getShellCandidates(shell)
	attach, execID, initial, err := a.tryAttachShell(sessCtx, cli, containerID, sessionID, shell, candidates)
	if err != nil {
		cancel()
		return err
	}

	a.createSwarmShellSession(sessCtx, cancel, cli, attach, execID, sessionID, initial)
	return nil
}

func swarmExecAttachTTY(ctx context.Context, cli swarmExecClient, containerID, shell string) (client.ExecAttachResult, string, error) {
	execConfig := client.ExecCreateOptions{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		TTY:          true,
		Cmd:          []string{shell},
	}
	execCreateResp, err := cli.ExecCreate(ctx, containerID, execConfig)
	if err != nil {
		return client.ExecAttachResult{}, "", err
	}
	execID := execCreateResp.ID
	hijackResp, err := cli.ExecAttach(ctx, execID, client.ExecAttachOptions{TTY: true})
	if err != nil {
		return client.ExecAttachResult{}, "", err
	}
	return hijackResp, execID, nil
}

func swarmExecAttachTTYWithProbe(ctx context.Context, cli swarmExecClient, containerID, shell string) (client.ExecAttachResult, string, []byte, error) {
	attach, execID, err := swarmExecAttachTTY(ctx, cli, containerID, shell)
	if err != nil {
		return client.ExecAttachResult{}, "", nil, err
	}

	// Probe: some engines report exec failures by writing an error string to the hijacked stream
	// and then closing, without returning an error from ContainerExecAttach.
	var initial []byte
	if attach.Conn != nil {
		_ = attach.Conn.SetReadDeadline(time.Now().Add(250 * time.Millisecond))
	}
	buf := make([]byte, 512)
	n, rerr := attach.Reader.Read(buf)
	if attach.Conn != nil {
		_ = attach.Conn.SetReadDeadline(time.Time{})
	}
	if n > 0 {
		initial = append([]byte{}, buf[:n]...)
	}
	if rerr != nil {
		if ne, ok := rerr.(net.Error); ok && ne.Timeout() {
			// No immediate output; likely a valid interactive shell.
			return attach, execID, nil, nil
		}
		// If the exec ended immediately, treat as failure.
		attach.Close()
		if len(initial) > 0 {
			return client.ExecAttachResult{}, "", nil, errors.New(strings.TrimSpace(string(initial)))
		}
		return client.ExecAttachResult{}, "", nil, fmt.Errorf("exec session closed")
	}

	lower := strings.ToLower(string(initial))
	if strings.Contains(lower, "oci runtime exec failed") ||
		strings.Contains(lower, "no such file or directory") ||
		(strings.Contains(lower, "exec:") && strings.Contains(lower, "stat")) ||
		strings.Contains(lower, "shell error") ||
		strings.Contains(lower, "unsupported") {
		attach.Close()
		return client.ExecAttachResult{}, "", nil, errors.New(strings.TrimSpace(string(initial)))
	}

	// Success. Preserve the initial output for the main stream reader.
	return attach, execID, initial, nil
}

var _ swarmExecClient = (*client.Client)(nil)
