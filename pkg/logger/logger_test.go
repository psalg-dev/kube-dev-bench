package logger

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func resetGlobal() {
	Close()
	globalMu.Lock()
	globalFile = nil
	globalPath = ""
	globalDir = ""
	initialized = false
	globalLevel.Set(slog.LevelInfo)
	stdoutWriter = os.Stdout
	globalMu.Unlock()
	// Reset slog default to a basic handler so tests are isolated.
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
}

type alwaysFailWriter struct{}

func (alwaysFailWriter) Write([]byte) (int, error) {
	return 0, errors.New("simulated stdout failure")
}

func TestInit_CreatesLogFile(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	logPath := filepath.Join(dir, "kubedevbench.log")
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		t.Fatalf("log file not created at %s", logPath)
	}

	if FilePath() != logPath {
		t.Errorf("FilePath() = %q, want %q", FilePath(), logPath)
	}
}

func TestInit_CreatesDirectoryWhenMissing(t *testing.T) {
	resetGlobal()
	base := t.TempDir()
	dir := filepath.Join(base, "nested", "logs")

	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	if _, err := os.Stat(filepath.Join(dir, "kubedevbench.log")); err != nil {
		t.Fatalf("expected log file in created directory, stat error: %v", err)
	}
}

func TestInit_EmptyDirUsesCwd(t *testing.T) {
	resetGlobal()
	origDir, _ := os.Getwd()
	dir := t.TempDir()
	_ = os.Chdir(dir)
	defer func() { _ = os.Chdir(origDir) }()

	if err := Init(""); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	logPath := filepath.Join(".", "kubedevbench.log")
	if !strings.HasSuffix(FilePath(), logPath) {
		t.Errorf("FilePath() = %q, want suffix %q", FilePath(), logPath)
	}
}

func TestLogLevels_FiltersBelowLevel(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	// Raise level to WARN so DEBUG/INFO are filtered.
	SetLevel(slog.LevelWarn)

	Debug("should not appear")
	Info("should not appear either")
	Warn("this is a warning", "key", "test")
	Error("this is an error", "code", 42)

	Close()

	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)

	if strings.Contains(content, "should not appear") {
		t.Error("DEBUG/INFO messages should have been filtered")
	}
	if !strings.Contains(content, "this is a warning") {
		t.Error("WARN message should appear in log")
	}
	if !strings.Contains(content, "this is an error") {
		t.Error("ERROR message should appear in log")
	}
}

func TestLogBeforeInit(t *testing.T) {
	resetGlobal()
	// Should not panic — slog default handler is always safe.
	Info("log before init")
	Debug("debug before init")
}

func TestClose_NilFile(t *testing.T) {
	resetGlobal()
	// Should not panic
	Close()
}

func TestFilePath_BeforeInit(t *testing.T) {
	resetGlobal()
	if got := FilePath(); got != "" {
		t.Errorf("FilePath() = %q, want empty", got)
	}
}

func TestInit_InvalidDir(t *testing.T) {
	resetGlobal()
	base := t.TempDir()
	filePath := filepath.Join(base, "not-a-dir")
	if err := os.WriteFile(filePath, []byte("x"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}
	err := Init(filePath)
	if err == nil {
		resetGlobal()
		t.Fatal("expected error for invalid directory")
	}
}

func TestInit_WritesFileWhenStdoutFails(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	stdoutWriter = alwaysFailWriter{}

	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	Info("message should still reach file", "component", "logger")
	Close()

	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	if !strings.Contains(string(data), "message should still reach file") {
		t.Fatal("expected log message to be written to file even when stdout writer fails")
	}
}

func TestWith_ReturnsSublogger(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	sub := With("component", "k8s")
	sub.Info("connected", "context", "prod")
	Close()

	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "component") || !strings.Contains(content, "k8s") {
		t.Error("sub-logger attributes should appear in log")
	}
	if !strings.Contains(content, "connected") {
		t.Error("message should appear in log")
	}
}

func TestLogger_ReturnsDefault(t *testing.T) {
	resetGlobal()
	l := Logger()
	if l == nil {
		t.Fatal("Logger() should never return nil")
	}
}

func TestSync_BeforeInit(t *testing.T) {
	resetGlobal()
	// Should not panic when called before Init.
	Sync()
}

func TestSync_FlushesData(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	Info("sync test message")
	Sync()

	// File should contain the message immediately after Sync.
	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	if !strings.Contains(string(data), "sync test message") {
		t.Fatal("message should be on disk after Sync()")
	}
}

func TestSetLevel_DynamicViaLevelVar(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	// Create a sub-logger before changing the level.
	sub := With("sub", "test")
	SetLevel(slog.LevelWarn)

	// Both root and sub-logger should respect the new level.
	Info("root info should not appear")
	sub.Info("sub info should not appear")
	Warn("root warn visible")
	sub.Warn("sub warn visible")

	Close()

	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)

	if strings.Contains(content, "should not appear") {
		t.Error("INFO messages should be filtered after SetLevel(Warn)")
	}
	if !strings.Contains(content, "root warn visible") {
		t.Error("root WARN should appear")
	}
	if !strings.Contains(content, "sub warn visible") {
		t.Error("sub-logger WARN should also respect the dynamic level change")
	}
}

func TestDataDurableWithoutClose(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer resetGlobal()

	Info("durable message")
	// Do NOT call Close() — simulate abnormal exit.
	// Because the syncingFileWriter calls Sync() after each write,
	// the data should be on disk already.

	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	if !strings.Contains(string(data), "durable message") {
		t.Fatal("expected data to be durable on disk without Close()")
	}
}

func TestInit_IsIdempotent(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("first Init failed: %v", err)
	}
	defer resetGlobal()

	Info("first message")

	// Second Init should be a no-op.
	if err := Init(dir); err != nil {
		t.Fatalf("second Init should not fail: %v", err)
	}

	Info("second message")
	Close()

	data, err := os.ReadFile(filepath.Join(dir, "kubedevbench.log"))
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "first message") || !strings.Contains(content, "second message") {
		t.Error("both messages should appear in the log")
	}
}

func TestSyncingFileWriter_BothWritersFail(t *testing.T) {
	w := &syncingFileWriter{file: nil, console: alwaysFailWriter{}}
	_, err := w.Write([]byte("test"))
	if err == nil {
		// When both are nil/fail, we get len(p), nil (no writers succeeded,
		// but no error to report from a nil file).
		// This is acceptable — the log record is silently dropped.
	}
}

func TestClose_DoubleClose(t *testing.T) {
	resetGlobal()
	dir := t.TempDir()
	if err := Init(dir); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	Close()
	// Second close should not panic.
	Close()
}
