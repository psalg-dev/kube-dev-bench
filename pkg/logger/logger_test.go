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
	globalFile = nil
	globalPath = ""
	initialized = false
	stdoutWriter = os.Stdout
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
