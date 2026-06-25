package app

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/moby/moby/client"
	"github.com/moby/moby/api/types/swarm"
)

// mockSwarmExecClient implements swarmExecClient for testing
type mockSwarmExecClient struct {
	taskInspectFunc  func(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error)
	execCreateFunc   func(context.Context, string, client.ExecCreateOptions) (client.ExecCreateResult, error)
	execAttachFunc   func(context.Context, string, client.ExecAttachOptions) (client.ExecAttachResult, error)
	execInspectFunc  func(context.Context, string, client.ExecInspectOptions) (client.ExecInspectResult, error)
	execResizeFunc   func(context.Context, string, client.ExecResizeOptions) (client.ExecResizeResult, error)
}

func (m *mockSwarmExecClient) TaskInspect(ctx context.Context, taskID string, opts client.TaskInspectOptions) (client.TaskInspectResult, error) {
	if m.taskInspectFunc != nil {
		return m.taskInspectFunc(ctx, taskID, opts)
	}
	return client.TaskInspectResult{}, nil
}

func (m *mockSwarmExecClient) ExecCreate(ctx context.Context, containerID string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
	if m.execCreateFunc != nil {
		return m.execCreateFunc(ctx, containerID, config)
	}
	return client.ExecCreateResult{ID: "exec-123"}, nil
}

func (m *mockSwarmExecClient) ExecAttach(ctx context.Context, execID string, config client.ExecAttachOptions) (client.ExecAttachResult, error) {
	if m.execAttachFunc != nil {
		return m.execAttachFunc(ctx, execID, config)
	}
	return client.ExecAttachResult{}, nil
}

func (m *mockSwarmExecClient) ExecResize(ctx context.Context, execID string, options client.ExecResizeOptions) (client.ExecResizeResult, error) {
	if m.execResizeFunc != nil {
		return m.execResizeFunc(ctx, execID, options)
	}
	return client.ExecResizeResult{}, nil
}

func (m *mockSwarmExecClient) ExecInspect(ctx context.Context, execID string, opts client.ExecInspectOptions) (client.ExecInspectResult, error) {
	if m.execInspectFunc != nil {
		return m.execInspectFunc(ctx, execID, opts)
	}
	return client.ExecInspectResult{}, nil
}

// mockConn implements net.Conn for testing
type mockConn struct {
	readDeadline time.Time
}

func (m *mockConn) Read(b []byte) (n int, err error)   { return 0, io.EOF }
func (m *mockConn) Write(b []byte) (n int, err error)  { return len(b), nil }
func (m *mockConn) Close() error                       { return nil }
func (m *mockConn) LocalAddr() net.Addr                { return nil }
func (m *mockConn) RemoteAddr() net.Addr               { return nil }
func (m *mockConn) SetDeadline(t time.Time) error      { return nil }
func (m *mockConn) SetReadDeadline(t time.Time) error  { m.readDeadline = t; return nil }
func (m *mockConn) SetWriteDeadline(t time.Time) error { return nil }

// mockReader implements io.Reader for testing
type mockReader struct {
	data     []byte
	position int
	err      error
}

func (m *mockReader) Read(p []byte) (n int, err error) {
	if m.position >= len(m.data) {
		if m.err != nil {
			return 0, m.err
		}
		return 0, io.EOF
	}
	n = copy(p, m.data[m.position:])
	m.position += n
	if m.position >= len(m.data) && m.err != nil {
		return n, m.err
	}
	return n, nil
}

func TestStartSwarmTaskExecSession_EmptySessionID(t *testing.T) {
	app := &App{ctx: context.Background()}
	cli := &mockSwarmExecClient{}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), cli, "", "task-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error for empty sessionID")
	}
	if !strings.Contains(err.Error(), "sessionID is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestStartSwarmTaskExecSession_EmptyTaskID(t *testing.T) {
	app := &App{ctx: context.Background()}
	cli := &mockSwarmExecClient{}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), cli, "session-123", "", "/bin/sh")
	if err == nil {
		t.Fatal("expected error for empty taskID")
	}
	if !strings.Contains(err.Error(), "taskID is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestStartSwarmTaskExecSession_NilClient(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), nil, "session-123", "task-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error for nil client")
	}
	if !strings.Contains(err.Error(), "docker client is nil") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestStartSwarmTaskExecSession_TaskInspectError(t *testing.T) {
	app := &App{ctx: context.Background()}
	cli := &mockSwarmExecClient{
		taskInspectFunc: func(_ context.Context, _ string, _ client.TaskInspectOptions) (client.TaskInspectResult, error) {
			return client.TaskInspectResult{}, errors.New("task not found")
		},
	}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), cli, "session-123", "task-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error for task inspect failure")
	}
	if !strings.Contains(err.Error(), "task not found") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestStartSwarmTaskExecSession_NoContainer(t *testing.T) {
	app := &App{ctx: context.Background()}
	cli := &mockSwarmExecClient{
		taskInspectFunc: func(_ context.Context, taskID string, _ client.TaskInspectOptions) (client.TaskInspectResult, error) {
			// Return task with no container status
			return client.TaskInspectResult{
				Task: swarm.Task{
					ID: taskID,
				},
			}, nil
		},
	}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), cli, "session-123", "task-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error for task with no container")
	}
	if !strings.Contains(err.Error(), "task has no container yet") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestStartSwarmTaskExecSession_Success(t *testing.T) {
	app := &App{ctx: context.Background()}

	execCreateCalled := false
	execAttachCalled := false

	cli := &mockSwarmExecClient{
		taskInspectFunc: func(_ context.Context, taskID string, _ client.TaskInspectOptions) (client.TaskInspectResult, error) {
			return client.TaskInspectResult{
				Task: swarm.Task{
					ID: taskID,
					Status: swarm.TaskStatus{
						ContainerStatus: &swarm.ContainerStatus{
							ContainerID: "container-123",
						},
					},
				},
			}, nil
		},
		execCreateFunc: func(_ context.Context, containerID string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			execCreateCalled = true
			if containerID != "container-123" {
				t.Errorf("unexpected containerID: %s", containerID)
			}
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			execAttachCalled = true
			mockConn := &mockConn{}
			mockReader := &mockReader{data: []byte{}}

			// Simulate timeout on first read to indicate success
			mockReader.err = &net.OpError{Op: "read", Err: &timeoutError{}}

			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
		execResizeFunc: func(_ context.Context, _ string, _ client.ExecResizeOptions) (client.ExecResizeResult, error) {
			return client.ExecResizeResult{}, nil
		},
	}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), cli, "session-123", "task-123", "/bin/sh")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !execCreateCalled {
		t.Error("ExecCreate was not called")
	}
	if !execAttachCalled {
		t.Error("ExecAttach was not called")
	}

	// Verify session was registered
	val, ok := shellSessions.Load("session-123")
	if !ok {
		t.Error("session was not registered")
	}
	if val == nil {
		t.Error("registered session is nil")
	}

	// Cleanup
	shellSessions.Delete("session-123")
}

// timeoutError implements net.Error for testing
type timeoutError struct{}

func (e *timeoutError) Error() string   { return "timeout" }
func (e *timeoutError) Timeout() bool   { return true }
func (e *timeoutError) Temporary() bool { return true }

func TestSwarmExecAttachTTY_Success(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
			if !config.TTY {
				t.Error("TTY should be true")
			}
			if !config.AttachStdin || !config.AttachStdout || !config.AttachStderr {
				t.Error("All attach flags should be true")
			}
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, config client.ExecAttachOptions) (client.ExecAttachResult, error) {
			if !config.TTY {
				t.Error("TTY should be true")
			}
			return client.ExecAttachResult{}, nil
		},
	}

	resp, execID, err := swarmExecAttachTTY(context.Background(), cli, "container-123", "/bin/sh")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if execID != "exec-123" {
		t.Errorf("unexpected execID: %s", execID)
	}
	if resp.Conn != nil {
		t.Error("unexpected conn in response")
	}
}

func TestSwarmExecAttachTTY_CreateError(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{}, errors.New("create failed")
		},
	}

	_, _, err := swarmExecAttachTTY(context.Background(), cli, "container-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "create failed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSwarmExecAttachTTY_AttachError(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			return client.ExecAttachResult{}, errors.New("attach failed")
		},
	}

	_, _, err := swarmExecAttachTTY(context.Background(), cli, "container-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "attach failed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSwarmExecAttachTTYWithProbe_Timeout(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			mockConn := &mockConn{}
			mockReader := &mockReader{err: &timeoutError{}}
			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
	}

	resp, execID, initial, err := swarmExecAttachTTYWithProbe(context.Background(), cli, "container-123", "/bin/sh")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if execID != "exec-123" {
		t.Errorf("unexpected execID: %s", execID)
	}
	if len(initial) != 0 {
		t.Errorf("expected no initial data, got %d bytes", len(initial))
	}
	if resp.Conn == nil {
		t.Error("expected conn in response")
	}
}

func TestSwarmExecAttachTTYWithProbe_OCIRuntimeError(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			mockConn := &mockConn{}
			mockReader := &mockReader{
				data: []byte("OCI runtime exec failed: exec failed"),
				err:  io.EOF,
			}
			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
	}

	_, _, _, err := swarmExecAttachTTYWithProbe(context.Background(), cli, "container-123", "/bin/bash")
	if err == nil {
		t.Fatal("expected error for OCI runtime error")
	}
	if !strings.Contains(err.Error(), "OCI runtime exec failed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSwarmExecAttachTTYWithProbe_NoSuchFile(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			mockConn := &mockConn{}
			mockReader := &mockReader{
				data: []byte("no such file or directory"),
				err:  io.EOF,
			}
			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
	}

	_, _, _, err := swarmExecAttachTTYWithProbe(context.Background(), cli, "container-123", "/bin/invalid")
	if err == nil {
		t.Fatal("expected error for no such file")
	}
	if !strings.Contains(err.Error(), "no such file or directory") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSwarmExecAttachTTYWithProbe_ImmediateClose(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			mockConn := &mockConn{}
			mockReader := &mockReader{err: io.EOF}
			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
	}

	_, _, _, err := swarmExecAttachTTYWithProbe(context.Background(), cli, "container-123", "/bin/sh")
	if err == nil {
		t.Fatal("expected error for immediate close")
	}
	if !strings.Contains(err.Error(), "exec session closed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSwarmExecAttachTTYWithProbe_SuccessWithInitialData(t *testing.T) {
	cli := &mockSwarmExecClient{
		execCreateFunc: func(_ context.Context, _ string, _ client.ExecCreateOptions) (client.ExecCreateResult, error) {
			return client.ExecCreateResult{ID: "exec-123"}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			mockConn := &mockConn{}
			mockReader := &mockReader{
				data: []byte("$ "), // Shell prompt
			}
			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
	}

	resp, execID, initial, err := swarmExecAttachTTYWithProbe(context.Background(), cli, "container-123", "/bin/sh")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if execID != "exec-123" {
		t.Errorf("unexpected execID: %s", execID)
	}
	if string(initial) != "$ " {
		t.Errorf("unexpected initial data: %q", string(initial))
	}
	if resp.Conn == nil {
		t.Error("expected conn in response")
	}
}

func TestStartSwarmTaskExecSession_AutoShellFallback(t *testing.T) {
	app := &App{ctx: context.Background()}

	attempts := []string{}

	cli := &mockSwarmExecClient{
		taskInspectFunc: func(_ context.Context, taskID string, _ client.TaskInspectOptions) (client.TaskInspectResult, error) {
			return client.TaskInspectResult{
				Task: swarm.Task{
					ID: taskID,
					Status: swarm.TaskStatus{
						ContainerStatus: &swarm.ContainerStatus{
							ContainerID: "container-123",
						},
					},
				},
			}, nil
		},
		execCreateFunc: func(_ context.Context, _ string, config client.ExecCreateOptions) (client.ExecCreateResult, error) {
			if len(config.Cmd) > 0 {
				attempts = append(attempts, config.Cmd[0])
			}
			return client.ExecCreateResult{ID: fmt.Sprintf("exec-%d", len(attempts))}, nil
		},
		execAttachFunc: func(_ context.Context, _ string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
			mockConn := &mockConn{}

			// First attempt fails, second succeeds
			if len(attempts) == 1 {
				mockReader := &mockReader{
					data: []byte("no such file or directory"),
					err:  io.EOF,
				}
				return client.ExecAttachResult{
					HijackedResponse: client.HijackedResponse{
						Conn:   mockConn,
						Reader: bufio.NewReader(mockReader),
					},
				}, nil
			}

			// Success on second attempt
			mockReader := &mockReader{err: &timeoutError{}}
			return client.ExecAttachResult{
				HijackedResponse: client.HijackedResponse{
					Conn:   mockConn,
					Reader: bufio.NewReader(mockReader),
				},
			}, nil
		},
	}

	err := app.startSwarmTaskExecSessionWithClient(context.Background(), cli, "session-fallback", "task-123", "auto")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(attempts) < 2 {
		t.Errorf("expected at least 2 shell attempts, got %d", len(attempts))
	}
}