package holmesgpt

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// resetLogger resets the package-level logger singleton so each test starts fresh.
func resetLogger(t *testing.T) {
	t.Helper()
	if defaultLogger != nil {
		_ = defaultLogger.Close()
	}
	defaultLogger = nil
	loggerOnce = sync.Once{}
}

// ----------------------------------------------------------------------------
// TestInitLogger
// ----------------------------------------------------------------------------

// TestInitLogger_CreatesLogFile verifies the log file exists after InitLogger(t.TempDir()).
func TestInitLogger_CreatesLogFile(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() unexpected error: %v", err)
	}

	logPath := filepath.Join(dir, "holmes.log")
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		t.Errorf("InitLogger() did not create log file at %s", logPath)
	}
}

// TestInitLogger_SetsDefaultLogger verifies defaultLogger is non-nil after init.
func TestInitLogger_SetsDefaultLogger(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}
	if defaultLogger == nil {
		t.Error("InitLogger() did not set defaultLogger")
	}
}

// TestInitLogger_DefaultPath verifies InitLogger("") uses the home-directory fallback.
func TestInitLogger_DefaultPath(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	if err := InitLogger(""); err != nil {
		t.Fatalf("InitLogger() with default path unexpected error: %v", err)
	}
	if defaultLogger == nil {
		t.Error("InitLogger() did not set defaultLogger for empty path")
	}
}

// TestInitLogger_OnlyRunsOnce verifies sync.Once prevents a second initialization.
func TestInitLogger_OnlyRunsOnce(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir1 := t.TempDir()
	if err := InitLogger(dir1); err != nil {
		t.Fatalf("first InitLogger() error: %v", err)
	}
	firstPath := GetLogPath()

	dir2 := t.TempDir()
	if err := InitLogger(dir2); err != nil {
		t.Fatalf("second InitLogger() error: %v", err)
	}

	if GetLogPath() != firstPath {
		t.Errorf("InitLogger ran twice; expected path %q, got %q", firstPath, GetLogPath())
	}
}

// TestInitLogger_LogFileIsWritable verifies a line written immediately after init
// appears in the log file.
func TestInitLogger_LogFileIsWritable(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	GetLogger().Info("writable-check")

	data, err := os.ReadFile(filepath.Join(dir, "holmes.log"))
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}
	if !strings.Contains(string(data), "writable-check") {
		t.Errorf("expected 'writable-check' in log file, got: %s", string(data))
	}
}

// ----------------------------------------------------------------------------
// TestGetLogPath
// ----------------------------------------------------------------------------

// TestGetLogPath verifies the path before and after InitLogger.
func TestGetLogPath(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	// Before init: must return "".
	if got := GetLogPath(); got != "" {
		t.Errorf("GetLogPath() before init: expected \"\", got %q", got)
	}

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	expected := filepath.Join(dir, "holmes.log")
	if got := GetLogPath(); got != expected {
		t.Errorf("GetLogPath() expected %q, got %q", expected, got)
	}
}

// TestGetLogPath_NilLogger exercises the nil-defaultLogger branch explicitly.
func TestGetLogPath_NilLogger(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	// Explicitly nil just in case.
	defaultLogger = nil

	if got := GetLogPath(); got != "" {
		t.Errorf("GetLogPath() with nil defaultLogger should return \"\", got %q", got)
	}
}

// ----------------------------------------------------------------------------
// TestFileLogger
// ----------------------------------------------------------------------------

// TestFileLogger_Warn verifies Warn writes the message and WARN level to the file.
func TestFileLogger_Warn(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	l := GetLogger()
	l.Warn("test warning message", "key", "val")

	data, err := os.ReadFile(filepath.Join(dir, "holmes.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "test warning message") {
		t.Errorf("expected 'test warning message' in log, got: %s", content)
	}
	if !strings.Contains(content, "WARN") {
		t.Errorf("expected 'WARN' level in log, got: %s", content)
	}
	if !strings.Contains(content, "key=val") {
		t.Errorf("expected 'key=val' in log, got: %s", content)
	}
}

// TestFileLogger_AllLevels verifies Debug/Info/Warn/Error each appear in the file.
func TestFileLogger_AllLevels(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	l := GetLogger()
	l.Debug("debug-msg")
	l.Info("info-msg")
	l.Warn("warn-msg")
	l.Error("error-msg")

	data, err := os.ReadFile(filepath.Join(dir, "holmes.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)
	for _, want := range []string{"debug-msg", "info-msg", "warn-msg", "error-msg"} {
		if !strings.Contains(content, want) {
			t.Errorf("expected %q in log file; got: %s", want, content)
		}
	}
}

// TestFileLogger_Close verifies Close on an open logger returns no error.
func TestFileLogger_Close(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}

	if err := GetLogger().Close(); err != nil {
		t.Errorf("Close() unexpected error: %v", err)
	}
}

// TestFileLogger_Close_NilFile verifies Close on a logger with nil file returns nil.
func TestFileLogger_Close_NilFile(t *testing.T) {
	l := &Logger{}
	if err := l.Close(); err != nil {
		t.Errorf("Close() on nil-file logger should return nil, got: %v", err)
	}
}

// TestFileLogger_Log_Disabled verifies the log method is a no-op when disabled.
func TestFileLogger_Log_Disabled(t *testing.T) {
	l := &Logger{enabled: false}
	// Must not panic even though logger field is nil.
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("log() panicked on disabled logger: %v", r)
		}
	}()
	l.Debug("should be ignored")
	l.Info("should be ignored")
	l.Warn("should be ignored")
	l.Error("should be ignored")
}

// TestFileLogger_KeyValuePairs verifies odd-length keyvals don't panic.
func TestFileLogger_KeyValuePairs(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	dir := t.TempDir()
	if err := InitLogger(dir); err != nil {
		t.Fatalf("InitLogger() error: %v", err)
	}
	l := GetLogger()

	defer func() {
		if r := recover(); r != nil {
			t.Errorf("log with odd keyvals panicked: %v", r)
		}
	}()
	// Odd number of keyvals (only key, no value) – should not panic.
	l.Info("odd-keyvals", "only-key")
}

// ----------------------------------------------------------------------------
// TestNoopLogger
// ----------------------------------------------------------------------------

// TestNoopLogger_AllMethods calls every *Logger method AND every package-level
// convenience function (lines 146-163) so that both sets are covered in the
// filtered test run.
func TestNoopLogger_AllMethods(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	// ---- 1. Method calls on the concrete *Logger returned by GetLogger ----
	//
	// With no InitLogger called, GetLogger returns a stdout-only logger
	// (no backing file).  This exercises Logger.Debug/Info/Warn/Error/Close.
	l := GetLogger()

	structMethods := []struct {
		name string
		fn   func()
	}{
		{"Debug", func() { l.Debug("debug msg", "k", "v") }},
		{"Info", func() { l.Info("info msg") }},
		{"Warn", func() { l.Warn("warn msg") }},
		{"Error", func() { l.Error("error msg") }},
		{"Close", func() { _ = l.Close() }},
	}

	for _, m := range structMethods {
		m := m
		t.Run(m.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("%s panicked: %v", m.name, r)
				}
			}()
			m.fn()
		})
	}

	// ---- 2. Package-level convenience functions (logger.go:146-163) ----
	//
	// These are separate top-level functions (not methods on Logger) and must
	// be invoked explicitly so the coverage tool registers hits on those lines
	// even during the filtered test run.
	pkgFunctions := []struct {
		name string
		fn   func()
	}{
		{"PkgDebug", func() { Debug("pkg-level debug", "k", "v") }},
		{"PkgInfo", func() { Info("pkg-level info") }},
		{"PkgWarn", func() { Warn("pkg-level warn") }},
		{"PkgError", func() { Error("pkg-level error") }},
	}

	for _, m := range pkgFunctions {
		m := m
		t.Run(m.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("%s panicked: %v", m.name, r)
				}
			}()
			m.fn()
		})
	}
}

// TestNoopLogger_GetLogger_ReturnsFallback verifies GetLogger creates a fallback
// when defaultLogger is nil (exercises the nil branch in GetLogger).
func TestNoopLogger_GetLogger_ReturnsFallback(t *testing.T) {
	resetLogger(t)
	defer resetLogger(t)

	l := GetLogger()
	if l == nil {
		t.Fatal("GetLogger() returned nil; expected fallback logger")
	}
}

// TestNoopLogger_NilReceiverClose verifies a nil-receiver Close returns nil.
func TestNoopLogger_NilReceiverClose(t *testing.T) {
	var l *Logger
	if err := l.Close(); err != nil {
		t.Errorf("(*Logger)(nil).Close() should return nil, got: %v", err)
	}
}
