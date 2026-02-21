package holmesgpt

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// resetLogger resets the package-level logger singleton so each test starts fresh.
func resetLogger() {
	defaultLogger = nil
	loggerOnce = sync.Once{}
}

func TestInitLogger_CreatesLogFile(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	logPath := filepath.Join(dir, "holmes.log")
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		t.Errorf("InitLogger() expected log file %q to exist, but it does not", logPath)
	}

	if defaultLogger == nil {
		t.Error("InitLogger() expected defaultLogger to be non-nil")
	}
}

func TestInitLogger_DefaultPath(t *testing.T) {
	resetLogger()
	defer resetLogger()

	// Passing empty string should fall back to home directory path
	err := InitLogger("")
	if err != nil {
		t.Fatalf("InitLogger(\"\") unexpected error: %v", err)
	}

	if defaultLogger == nil {
		t.Error("InitLogger(\"\") expected defaultLogger to be non-nil")
	}

	// Clean up the created log file
	if defaultLogger != nil && defaultLogger.file != nil {
		_ = defaultLogger.file.Close()
		_ = os.Remove(defaultLogger.logPath)
	}
}

func TestInitLogger_IdempotentViaSyncOnce(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("first InitLogger() error: %v", err)
	}
	first := defaultLogger

	// Second call should be a no-op (sync.Once)
	if err := InitLogger(dir); err != nil {
		t.Fatalf("second InitLogger() error: %v", err)
	}
	if defaultLogger != first {
		t.Error("InitLogger() should be idempotent — defaultLogger pointer changed on second call")
	}
}

func TestGetLogPath_AfterInit(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	got := GetLogPath()
	want := filepath.Join(dir, "holmes.log")
	if got != want {
		t.Errorf("GetLogPath() = %q, want %q", got, want)
	}
}

func TestGetLogPath_BeforeInit(t *testing.T) {
	resetLogger()
	defer resetLogger()

	if got := GetLogPath(); got != "" {
		t.Errorf("GetLogPath() before init = %q, want empty string", got)
	}
}

func TestGetLogger_FallbackWhenNil(t *testing.T) {
	resetLogger()
	defer resetLogger()

	l := GetLogger()
	if l == nil {
		t.Error("GetLogger() should return a non-nil fallback logger when not initialised")
	}
}

func TestGetLogger_ReturnsDefaultAfterInit(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	if GetLogger() != defaultLogger {
		t.Error("GetLogger() should return the initialised defaultLogger")
	}
}

func TestFileLogger_WriteMethods(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	l := GetLogger()

	// All write methods must not panic
	l.Debug("debug message", "key", "val")
	l.Info("info message", "k", 1)
	l.Warn("warn message")
	l.Error("error message", "err", "something")

	// Verify content was written to the log file
	logPath := filepath.Join(dir, "holmes.log")
	data, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)

	for _, want := range []string{"debug message", "info message", "warn message", "error message"} {
		if !strings.Contains(content, want) {
			t.Errorf("log file missing expected message %q", want)
		}
	}
}

func TestFileLogger_Warn_WithKeyVals(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	l := GetLogger()
	l.Warn("test warning", "component", "holmes", "code", 42)

	data, err := os.ReadFile(filepath.Join(dir, "holmes.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "WARN") {
		t.Error("expected WARN level in log output")
	}
	if !strings.Contains(content, "test warning") {
		t.Error("expected message in log output")
	}
	if !strings.Contains(content, "component=holmes") {
		t.Error("expected key=value pair in log output")
	}
}

func TestFileLogger_Close(t *testing.T) {
	resetLogger()
	defer resetLogger()

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	l := GetLogger()
	if err := l.Close(); err != nil {
		t.Errorf("Close() unexpected error: %v", err)
	}
}

func TestNoopLogger_AllMethods(t *testing.T) {
	// A nil *Logger must not panic — the receiver methods guard for nil.
	assertNoPanic := func(name string, fn func()) {
		t.Helper()
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("%s panicked: %v", name, r)
			}
		}()
		fn()
	}

	var noop *Logger

	assertNoPanic("Debug", func() { noop.Debug("msg", "k", "v") })
	assertNoPanic("Info", func() { noop.Info("msg") })
	assertNoPanic("Warn", func() { noop.Warn("msg", "a", 1) })
	assertNoPanic("Error", func() { noop.Error("msg") })
	assertNoPanic("Close", func() { _ = noop.Close() })

	// Also verify a disabled logger doesn't panic
	disabled := &Logger{enabled: false}
	assertNoPanic("disabled Debug", func() { disabled.Debug("x") })
	assertNoPanic("disabled Info", func() { disabled.Info("x") })
	assertNoPanic("disabled Warn", func() { disabled.Warn("x") })
	assertNoPanic("disabled Error", func() { disabled.Error("x") })
	assertNoPanic("disabled Close", func() { _ = disabled.Close() })
}

func TestFileLogger_PackageLevelFunctions(t *testing.T) {
	resetLogger()
	defer resetLogger()

	// Package-level functions delegate to GetLogger() — must not panic
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("package-level log function panicked: %v", r)
		}
	}()

	Debug("pkg debug", "k", "v")
	Info("pkg info")
	Warn("pkg warn", "x", 1)
	Error("pkg error")
}
