package app

import (
	"context"
	"io"
	"testing"
)

// ─── SendShellInput ───────────────────────────────────────────────────────────

// TestSendShellInput_NotFound verifies that an error is returned when the
// session does not exist.
func TestSendShellInput_NotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	err := app.SendShellInput("nonexistent-session", "ls")
	if err == nil {
		t.Error("expected error for missing session, got nil")
	}
}

// TestSendShellInput_WithStdin verifies that input is written to the Stdin
// stream when a session has Stdin set (no PTY).
func TestSendShellInput_WithStdin(t *testing.T) {
	pr, pw := io.Pipe()
	sessionID := "test-send-stdin-1"
	shellSessions.Store(sessionID, &ShellSession{Stdin: pw})
	t.Cleanup(func() {
		shellSessions.Delete(sessionID)
		_ = pw.Close()
		_ = pr.Close()
	})

	// Drain pr asynchronously to prevent the write from blocking.
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 64)
		_, _ = pr.Read(buf)
	}()

	app := &App{ctx: context.Background()}
	if err := app.SendShellInput(sessionID, "echo hello\n"); err != nil {
		t.Errorf("SendShellInput() error = %v", err)
	}
	_ = pw.Close() // signal EOF so the goroutine exits
	<-done
}

// TestSendShellInput_NoStream verifies that an error is returned when the
// session has neither PTY nor Stdin.
func TestSendShellInput_NoStream(t *testing.T) {
	sessionID := "test-send-nostream-1"
	shellSessions.Store(sessionID, &ShellSession{})
	t.Cleanup(func() { shellSessions.Delete(sessionID) })

	app := &App{ctx: context.Background()}
	err := app.SendShellInput(sessionID, "anything")
	if err == nil {
		t.Error("expected error for session with no stream, got nil")
	}
}

// ─── ResizeShellSession ───────────────────────────────────────────────────────

// TestResizeShellSession_NotFound ensures an error is returned for a missing
// session.
func TestResizeShellSession_NotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	err := app.ResizeShellSession("missing-resize-sess", 80, 24)
	if err == nil {
		t.Error("expected error for missing session, got nil")
	}
}

// TestResizeShellSession_OutOfRange tests the safeUint16FromInt error path for
// out-of-range col/row values.
func TestResizeShellSession_OutOfRange(t *testing.T) {
	sessionID := "test-resize-oor-1"
	shellSessions.Store(sessionID, &ShellSession{})
	t.Cleanup(func() { shellSessions.Delete(sessionID) })

	app := &App{ctx: context.Background()}
	// Use a negative value which is out of uint16 range.
	if err := app.ResizeShellSession(sessionID, -1, 24); err == nil {
		t.Error("expected error for negative cols, got nil")
	}
}

// TestResizeShellSession_WithSizeQueue tests the SizeQ.Push path.
func TestResizeShellSession_WithSizeQueue(t *testing.T) {
	sizeQ := newTerminalSizeQueue()
	sessionID := "test-resize-sizeq-1"
	shellSessions.Store(sessionID, &ShellSession{SizeQ: sizeQ})
	t.Cleanup(func() {
		shellSessions.Delete(sessionID)
		sizeQ.Close()
	})

	app := &App{ctx: context.Background()}
	if err := app.ResizeShellSession(sessionID, 132, 50); err != nil {
		t.Errorf("ResizeShellSession() error = %v", err)
	}
}

// TestResizeShellSession_WithResizeFn tests the ResizeFn-only path (no PTY, no
// SizeQ).
func TestResizeShellSession_WithResizeFn(t *testing.T) {
	called := false
	sessionID := "test-resize-resizefn-1"
	shellSessions.Store(sessionID, &ShellSession{
		ResizeFn: func(cols, rows int) error {
			called = true
			return nil
		},
	})
	t.Cleanup(func() { shellSessions.Delete(sessionID) })

	app := &App{ctx: context.Background()}
	if err := app.ResizeShellSession(sessionID, 80, 24); err != nil {
		t.Errorf("ResizeShellSession() error = %v", err)
	}
	if !called {
		t.Error("expected ResizeFn to be called, but it was not")
	}
}

// TestResizeShellSession_NoStreams tests the path where the session has no PTY,
// no SizeQ, and no ResizeFn — should return nil.
func TestResizeShellSession_NoStreams(t *testing.T) {
	sessionID := "test-resize-nostreams-1"
	shellSessions.Store(sessionID, &ShellSession{})
	t.Cleanup(func() { shellSessions.Delete(sessionID) })

	app := &App{ctx: context.Background()}
	if err := app.ResizeShellSession(sessionID, 80, 24); err != nil {
		t.Errorf("expected nil error for empty session, got %v", err)
	}
}

// ─── StopShellSession ─────────────────────────────────────────────────────────

// TestStopShellSession_NotFound verifies that an error is returned when the
// session does not exist.
func TestStopShellSession_NotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	if err := app.StopShellSession("nonexistent-stop"); err == nil {
		t.Error("expected error for missing session, got nil")
	}
}

// TestStopShellSession_WithCancelAndSizeQ tests the full stop path with a
// cancel function, SizeQ, and Stdin pipe (no real process).
func TestStopShellSession_WithCancelAndSizeQ(t *testing.T) {
	_, cancel := context.WithCancel(context.Background())
	_, pw := io.Pipe()
	sizeQ := newTerminalSizeQueue()

	sessionID := "test-stop-full-1"
	shellSessions.Store(sessionID, &ShellSession{
		Cancel: cancel,
		SizeQ:  sizeQ,
		Stdin:  pw,
	})
	// No t.Cleanup needed: StopShellSession deletes the key itself.

	app := &App{ctx: context.Background()}
	if err := app.StopShellSession(sessionID); err != nil {
		t.Errorf("StopShellSession() error = %v", err)
	}
	if _, ok := shellSessions.Load(sessionID); ok {
		t.Error("expected session to be deleted after StopShellSession")
	}
}

// ─── StopPortForward ─────────────────────────────────────────────────────────

// TestStopPortForward_SameKeyFound tests the happy path where the exact same-
// port key exists in portForwardSessions.
func TestStopPortForward_SameKeyFound(t *testing.T) {
	_, cancel := context.WithCancel(context.Background())
	key := portForwardKey("default", "targetpod", 9090)
	portForwardSessions.Store(key, &PortForwardSession{Cancel: cancel})

	app := &App{ctx: context.Background()}
	if err := app.StopPortForward("default", "targetpod", 9090); err != nil {
		t.Errorf("StopPortForward() error = %v", err)
	}
	// Session must have been removed.
	if _, ok := portForwardSessions.Load(key); ok {
		t.Error("expected port-forward session to be deleted")
	}
}

// TestStopPortForward_NotFound verifies that an error is returned when no
// matching session exists.
func TestStopPortForward_NotFound(t *testing.T) {
	app := &App{ctx: context.Background()}
	err := app.StopPortForward("default", "nonexistent-pod", 1234)
	if err == nil {
		t.Error("expected error for missing port-forward session, got nil")
	}
}

// TestStopPortForward_EmptyNamespace tests the empty-namespace fall-through
// that uses currentNamespace instead.
func TestStopPortForward_EmptyNamespace(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "kube-system",
	}
	// No session exists for kube-system → expect error.
	err := app.StopPortForward("", "no-pod", 5678)
	if err == nil {
		t.Error("expected error when no session exists with currentNamespace, got nil")
	}
}

// ─── ListPortForwards ─────────────────────────────────────────────────────────

// TestListPortForwards_WithValidEntry verifies that a correctly-keyed session
// appears in the result.
func TestListPortForwards_WithValidEntry(t *testing.T) {
	key := "default/listpod:7070:7070"
	portForwardSessions.Store(key, &PortForwardSession{})
	t.Cleanup(func() { portForwardSessions.Delete(key) })

	app := &App{ctx: context.Background()}
	list, err := app.ListPortForwards()
	if err != nil {
		t.Fatalf("ListPortForwards() error = %v", err)
	}
	found := false
	for _, pf := range list {
		if pf.Pod == "listpod" && pf.Namespace == "default" && pf.Local == 7070 {
			found = true
		}
	}
	if !found {
		t.Error("expected to find listpod in ListPortForwards result")
	}
}

// ─── validatePortForwardParams ───────────────────────────────────────────────

// TestValidatePortForwardParams_PortOutOfRange verifies that over-range ports
// return an error.
func TestValidatePortForwardParams_PortOutOfRange(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "default",
	}
	_, err := app.validatePortForwardParams("default", "mypod", 99999, 80)
	if err == nil {
		t.Error("expected error for out-of-range local port, got nil")
	}
}
