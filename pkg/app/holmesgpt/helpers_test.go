package holmesgpt

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// retryDelay tests
// ---------------------------------------------------------------------------

func TestRetryDelay_ZeroAttempt(t *testing.T) {
	got := retryDelay(0)
	want := 500 * time.Millisecond
	if got != want {
		t.Errorf("retryDelay(0) = %v, want %v", got, want)
	}
}

func TestRetryDelay_OneAttempt(t *testing.T) {
	got := retryDelay(1)
	want := 1000 * time.Millisecond
	if got != want {
		t.Errorf("retryDelay(1) = %v, want %v", got, want)
	}
}

func TestRetryDelay_TwoAttempts(t *testing.T) {
	got := retryDelay(2)
	want := 2000 * time.Millisecond
	if got != want {
		t.Errorf("retryDelay(2) = %v, want %v", got, want)
	}
}

func TestRetryDelay_CapAt5Seconds(t *testing.T) {
	// attempt=4 → 500*(2^4)ms = 8000ms > 5s → should return 5s cap
	got := retryDelay(4)
	want := 5 * time.Second
	if got != want {
		t.Errorf("retryDelay(4) = %v, want %v", got, want)
	}
}

func TestRetryDelay_NegativeAttempt(t *testing.T) {
	// Negative attempt should be normalised to 0 → 500ms
	got := retryDelay(-1)
	want := 500 * time.Millisecond
	if got != want {
		t.Errorf("retryDelay(-1) = %v, want %v", got, want)
	}
}

func TestRetryDelay_LargeAttempt(t *testing.T) {
	// Very large attempt always returns the cap.
	got := retryDelay(10)
	if got != 5*time.Second {
		t.Errorf("retryDelay(10) = %v, want 5s cap", got)
	}
}

// ---------------------------------------------------------------------------
// shouldRetry tests
// ---------------------------------------------------------------------------

func TestShouldRetry_DeadlineExceeded(t *testing.T) {
	if !shouldRetry(context.DeadlineExceeded) {
		t.Error("shouldRetry(context.DeadlineExceeded) = false, want true")
	}
}

func TestShouldRetry_PlainError(t *testing.T) {
	if shouldRetry(errors.New("random error")) {
		t.Error("shouldRetry(plain error) = true, want false")
	}
}

func TestShouldRetry_Nil(t *testing.T) {
	if shouldRetry(nil) {
		t.Error("shouldRetry(nil) = true, want false")
	}
}

// ---------------------------------------------------------------------------
// sseParser helper
// ---------------------------------------------------------------------------

// newTestParser creates an sseParser for unit testing that accumulates
// dispatched events in the returned slice pointer.
func newTestParser(t *testing.T) (*sseParser, *[]string) {
	t.Helper()
	var events []string
	// Use a disabled logger so tests don't produce noise.
	log := &Logger{enabled: false, logger: GetLogger().logger}
	p := &sseParser{
		log: log,
		onEvent: func(event string, data []byte) error {
			events = append(events, fmt.Sprintf("%s:%s", event, string(data)))
			return nil
		},
	}
	return p, &events
}

// ---------------------------------------------------------------------------
// parseLine / dispatch tests
// ---------------------------------------------------------------------------

func TestSseParser_ParseLine_EmptyLine_DispatchesEvent(t *testing.T) {
	p, events := newTestParser(t)

	if err := p.parseLine("data: hello\n"); err != nil {
		t.Fatalf("parseLine data: unexpected error: %v", err)
	}
	if err := p.parseLine("\n"); err != nil {
		t.Fatalf("parseLine empty: unexpected error: %v", err)
	}

	if len(*events) != 1 {
		t.Fatalf("expected 1 dispatched event, got %d", len(*events))
	}
	if (*events)[0] != "message:hello" {
		t.Errorf("dispatched event = %q, want %q", (*events)[0], "message:hello")
	}
}

func TestSseParser_ParseLine_CommentLine_Ignored(t *testing.T) {
	p, events := newTestParser(t)

	if err := p.parseLine(": this is a comment\n"); err != nil {
		t.Fatalf("parseLine comment: unexpected error: %v", err)
	}
	// An empty dispatch after only a comment should be a no-op.
	if err := p.parseLine("\n"); err != nil {
		t.Fatalf("parseLine empty after comment: unexpected error: %v", err)
	}
	if len(*events) != 0 {
		t.Errorf("expected 0 events for comment-only input, got %d", len(*events))
	}
}

func TestSseParser_ParseLine_EventType(t *testing.T) {
	p, events := newTestParser(t)

	_ = p.parseLine("event: update\n")
	_ = p.parseLine("data: payload\n")
	_ = p.parseLine("\n") // dispatch

	if len(*events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(*events))
	}
	if (*events)[0] != "update:payload" {
		t.Errorf("event = %q, want %q", (*events)[0], "update:payload")
	}
}

func TestSseParser_ParseLine_MultipleDataLines(t *testing.T) {
	p, events := newTestParser(t)

	_ = p.parseLine("data: line1\n")
	_ = p.parseLine("data: line2\n")
	_ = p.parseLine("\n") // dispatch

	if len(*events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(*events))
	}
	if (*events)[0] != "message:line1\nline2" {
		t.Errorf("event = %q, want %q", (*events)[0], "message:line1\nline2")
	}
}

func TestSseParser_Dispatch_EmptyDataLines_NoOp(t *testing.T) {
	p, events := newTestParser(t)

	// dispatch with no accumulated data should be a no-op.
	if err := p.dispatch(); err != nil {
		t.Fatalf("dispatch() on empty parser: %v", err)
	}
	if len(*events) != 0 {
		t.Errorf("expected 0 events, got %d", len(*events))
	}
}

func TestSseParser_Dispatch_HighEventCount_NoDebugPanic(t *testing.T) {
	p, _ := newTestParser(t)

	// Drive count past the 5-event and mod-50 threshold to ensure no panic.
	for i := 0; i < 105; i++ {
		_ = p.parseLine("data: x\n")
		_ = p.parseLine("\n")
	}
}

func TestSseParser_ParseLine_UnknownField_Ignored(t *testing.T) {
	p, events := newTestParser(t)

	// Lines that don't start with a recognised field should be silently ignored.
	_ = p.parseLine("retry: 3000\n")
	_ = p.parseLine("data: ok\n")
	_ = p.parseLine("\n")

	if len(*events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(*events))
	}
}

func TestSseParser_ParseLine_OnEventError_Propagated(t *testing.T) {
	log := &Logger{enabled: false, logger: GetLogger().logger}
	sentinel := errors.New("callback error")
	p := &sseParser{
		log: log,
		onEvent: func(event string, data []byte) error {
			return sentinel
		},
	}

	_ = p.parseLine("data: trigger\n")
	err := p.parseLine("\n") // dispatch → triggers onEvent → returns sentinel
	if !errors.Is(err, sentinel) {
		t.Errorf("parseLine dispatch error = %v, want sentinel", err)
	}
}

func TestSseParser_ParseLine_DefaultEventType_Message(t *testing.T) {
	p, events := newTestParser(t)

	// When no event: line is given, the default type should be "message".
	_ = p.parseLine("data: test\n")
	_ = p.parseLine("\n")

	if len(*events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(*events))
	}
	if got := (*events)[0]; got[:7] != "message" {
		t.Errorf("default event type: got %q prefix, want \"message\"", got)
	}
}

func TestSseParser_ParseLine_CRLFTermination(t *testing.T) {
	p, events := newTestParser(t)

	// Lines ending with \r\n (CRLF) should be handled correctly.
	_ = p.parseLine("data: crlf\r\n")
	_ = p.parseLine("\r\n")

	if len(*events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(*events))
	}
	if (*events)[0] != "message:crlf" {
		t.Errorf("CRLF event = %q, want %q", (*events)[0], "message:crlf")
	}
}
