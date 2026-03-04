package logger

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func resetGlobal() {
	Close()
	globalFile = nil
	globalPath = ""
	once = sync.Once{}
	// Reset slog default to a basic handler so tests are isolated.
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
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
	err := Init("/nonexistent/path/that/should/not/exist/12345")
	if err == nil {
		resetGlobal()
		t.Fatal("expected error for invalid directory")
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
