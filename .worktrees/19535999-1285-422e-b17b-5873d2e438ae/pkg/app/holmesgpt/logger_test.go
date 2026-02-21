package holmesgpt

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// resetLoggerState resets the package-level logger globals so each test
// gets a clean slate despite sync.Once.
func resetLoggerState(t *testing.T) {
	t.Helper()
	if defaultLogger != nil {
		_ = defaultLogger.Close()
	}
	defaultLogger = nil
	loggerOnce = sync.Once{}
}

func TestInitLogger_CreatesLogFile(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	logFile := filepath.Join(dir, "holmes.log")
	if _, err := os.Stat(logFile); os.IsNotExist(err) {
		t.Errorf("InitLogger() did not create log file at %s", logFile)
	}
}

func TestGetLogPath(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	got := GetLogPath()
	if got == "" {
		t.Fatal("GetLogPath() returned empty string after InitLogger")
	}

	expected := filepath.Join(dir, "holmes.log")
	if got != expected {
		t.Errorf("GetLogPath() = %q, want %q", got, expected)
	}
}

func TestGetLogPath_BeforeInit(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	if got := GetLogPath(); got != "" {
		t.Errorf("GetLogPath() before init = %q, want empty string", got)
	}
}

func TestInitLogger_WarnAndClose(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	logger := GetLogger()
	// Exercise Warn; should not panic
	logger.Warn("test warning", "key", "value")

	if err := logger.Close(); err != nil {
		t.Errorf("Close() unexpected error: %v", err)
	}
}

func TestInitLogger_AllLogMethods(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	logger := GetLogger()
	// All methods should complete without panic
	logger.Debug("debug msg", "k", "v")
	logger.Info("info msg", "k", "v")
	logger.Warn("warn msg", "k", "v")
	logger.Error("error msg", "k", "v")
}

func TestNoopLogger_AllMethods(t *testing.T) {
	// A Logger writing to Discard exercises all code paths without side effects.
	noopLogger := &Logger{
		logger:  log.New(io.Discard, "", 0),
		enabled: true,
	}

	// All calls must complete without panic.
	noopLogger.Debug("debug")
	noopLogger.Info("info")
	noopLogger.Warn("warn")
	noopLogger.Error("error")
	noopLogger.Debug("with keyvals", "key1", "val1", "key2", "val2")

	if err := noopLogger.Close(); err != nil {
		t.Errorf("Close() on noop logger (nil file) returned error: %v", err)
	}
}

func TestLogger_DisabledSkipsLogging(t *testing.T) {
	disabledLogger := &Logger{
		logger:  log.New(io.Discard, "", 0),
		enabled: false,
	}

	// Methods should be no-ops when disabled — no panic expected.
	disabledLogger.Debug("debug")
	disabledLogger.Info("info")
	disabledLogger.Warn("warn")
	disabledLogger.Error("error")

	if err := disabledLogger.Close(); err != nil {
		t.Errorf("Close() unexpected error: %v", err)
	}
}

func TestGetLogger_FallbackWhenNotInitialised(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	logger := GetLogger()
	if logger == nil {
		t.Fatal("GetLogger() returned nil without initialisation")
	}

	// Fallback logger should work without panicking.
	logger.Info("fallback logger test")
}

func TestPackageLevelConvenienceFunctions(t *testing.T) {
	resetLoggerState(t)
	t.Cleanup(func() { resetLoggerState(t) })

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	// Package-level functions must not panic.
	Debug("debug message", "k", "v")
	Info("info message", "k", "v")
	Warn("warn message", "k", "v")
	Error("error message", "k", "v")
}
