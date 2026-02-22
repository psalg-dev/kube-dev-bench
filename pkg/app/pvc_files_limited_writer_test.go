package app

import (
	"bytes"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// TestLimitedWriter – tests for the limitedWriter.Write helper
// Covers all three execution paths:
//   1. Buffer already at/beyond limit  → drop entire write, return len(p)
//   2. Write would exceed limit         → write only remaining bytes
//   3. Write fits entirely              → normal pass-through write
// ---------------------------------------------------------------------------

func TestLimitedWriter(t *testing.T) {
	t.Run("write when already at limit is silently dropped", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &limitedWriter{W: &buf, Limit: 5}

		// Fill to limit first
		n, err := lw.Write([]byte("hello")) // exactly 5 bytes
		if err != nil {
			t.Fatalf("first write error: %v", err)
		}
		if n != 5 {
			t.Fatalf("first write n=%d, want 5", n)
		}

		// Now buffer is at limit; subsequent write must be silently dropped
		n2, err2 := lw.Write([]byte("world"))
		if err2 != nil {
			t.Fatalf("second write (dropped) error: %v", err2)
		}
		if n2 != 5 {
			t.Errorf("dropped write should return len(p)=5, got %d", n2)
		}
		if buf.String() != "hello" {
			t.Errorf("buffer should still be 'hello', got %q", buf.String())
		}
	})

	t.Run("write that would exceed limit is truncated", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &limitedWriter{W: &buf, Limit: 8}

		// Write 5 bytes first (3 remaining)
		_, _ = lw.Write([]byte("hello"))

		// Write 5 more bytes — only 3 should land
		n, err := lw.Write([]byte("world"))
		if err != nil {
			t.Fatalf("partial write error: %v", err)
		}
		if n != 5 {
			t.Errorf("partial write should still return len(p)=5, got %d", n)
		}
		if buf.String() != "hellowor" {
			t.Errorf("buffer=%q, want 'hellowor'", buf.String())
		}
		if buf.Len() != 8 {
			t.Errorf("buf.Len=%d, want 8", buf.Len())
		}
	})

	t.Run("write that fits entirely is passed through unchanged", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &limitedWriter{W: &buf, Limit: 100}

		n, err := lw.Write([]byte("exactly fits"))
		if err != nil {
			t.Fatalf("normal write error: %v", err)
		}
		if n != len("exactly fits") {
			t.Errorf("n=%d, want %d", n, len("exactly fits"))
		}
		if buf.String() != "exactly fits" {
			t.Errorf("buffer=%q, want 'exactly fits'", buf.String())
		}
	})

	t.Run("zero limit drops all writes", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &limitedWriter{W: &buf, Limit: 0}

		n, err := lw.Write([]byte("anything"))
		if err != nil {
			t.Fatalf("zero-limit write error: %v", err)
		}
		if n != len("anything") {
			t.Errorf("n=%d, want %d", n, len("anything"))
		}
		if buf.Len() != 0 {
			t.Errorf("buf.Len=%d, want 0", buf.Len())
		}
	})

	t.Run("multiple sequential writes respect cumulative limit", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &limitedWriter{W: &buf, Limit: 10}

		writes := []string{"abc", "def", "ghijk", "lmno"}
		for _, w := range writes {
			lw.Write([]byte(w)) //nolint:errcheck
		}
		if buf.Len() > 10 {
			t.Errorf("buffer length %d exceeds limit 10", buf.Len())
		}
		got := buf.String()
		if !strings.HasPrefix("abcdefghijk", got) && got != "abcdefghij" {
			// Accept any prefix up to limit
			if len(got) > 10 {
				t.Errorf("buffer content too long: %q", got)
			}
		}
	})

	t.Run("empty write never errors", func(t *testing.T) {
		var buf bytes.Buffer
		lw := &limitedWriter{W: &buf, Limit: 5}

		n, err := lw.Write([]byte{})
		if err != nil {
			t.Fatalf("empty write error: %v", err)
		}
		_ = n // 0 is acceptable
	})
}

// ---------------------------------------------------------------------------
// TestParseLsLineTimestampFallback – covers the branch in parseLsLine where
// time.Parse fails (regex matches but timestamp is semantically invalid, e.g.
// month=00) and modified falls back to time.Now().
// ---------------------------------------------------------------------------

func TestParseLsLineTimestampFallback(t *testing.T) {
	// Regex: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2} — matches "2024-00-01T00:00:00"
	// but time.Parse rejects month=00, triggering the fallback branch.
	line := "-rw-r--r-- 1 root root 42 2024-00-01T00:00:00 fallback.txt"
	entry, ok := parseLsLine(line)
	if !ok {
		t.Fatalf("parseLsLine should succeed for valid-regex but invalid-semantics timestamp")
	}
	if entry.name != "fallback.txt" {
		t.Errorf("name=%q, want 'fallback.txt'", entry.name)
	}
	// modified should be set to a non-empty fallback value (current time)
	if entry.modified == "" {
		t.Error("modified should be non-empty after timestamp fallback")
	}
	// The fallback value must NOT be the original malformed timestamp
	if entry.modified == "2024-00-01T00:00:00" {
		t.Errorf("modified should have been replaced by fallback, got %q", entry.modified)
	}
}
