package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestE2EDialogDir_EnvOverride(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(e2eDialogDirEnv, dir)

	if got := e2eDialogDir(); got != dir {
		t.Fatalf("expected %q, got %q", dir, got)
	}
}

func TestE2EDialogDir_MarkerFallback(t *testing.T) {
	t.Setenv(e2eDialogDirEnv, "")
	fallback := filepath.Join(os.TempDir(), "kdb-e2e-dialogs")
	marker := filepath.Join(fallback, e2eEnabledMarkerFile)

	if err := os.MkdirAll(fallback, 0o755); err != nil {
		t.Fatalf("mkdir fallback: %v", err)
	}
	if err := os.WriteFile(marker, []byte("1"), 0o644); err != nil {
		t.Fatalf("write marker: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Remove(marker)
	})

	if got := e2eDialogDir(); got != fallback {
		t.Fatalf("expected fallback %q, got %q", fallback, got)
	}
}

func TestConsumeOneShotPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, e2eSaveOverrideFile)
	if err := os.WriteFile(path, []byte("/tmp/file.txt"), 0o644); err != nil {
		t.Fatalf("write override: %v", err)
	}

	val, ok := consumeOneShotPath(dir, e2eSaveOverrideFile)
	if !ok || val != "/tmp/file.txt" {
		t.Fatalf("expected override value, got ok=%v val=%q", ok, val)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("expected override file removed")
	}

	path = filepath.Join(dir, e2eSaveOverrideFile)
	if err := os.WriteFile(path, []byte(""), 0o644); err != nil {
		t.Fatalf("write override: %v", err)
	}
	val, ok = consumeOneShotPath(dir, e2eSaveOverrideFile)
	if !ok || val != "" {
		t.Fatalf("expected empty override, got ok=%v val=%q", ok, val)
	}
}

func TestEnsureDir(t *testing.T) {
	base := t.TempDir()
	path := filepath.Join(base, "a", "b", "c")
	if err := ensureDir(path); err != nil {
		t.Fatalf("ensureDir failed: %v", err)
	}
	if info, err := os.Stat(path); err != nil || !info.IsDir() {
		t.Fatalf("expected directory created")
	}
}

func TestSafeBaseFilename(t *testing.T) {
	if got := safeBaseFilename("", "fallback.txt"); got != "fallback.txt" {
		t.Fatalf("expected fallback, got %q", got)
	}
	if got := safeBaseFilename("../evil.txt", "fallback.txt"); got != "evil.txt" {
		t.Fatalf("expected base name, got %q", got)
	}
	if got := safeBaseFilename(".", "fallback.txt"); got != "fallback.txt" {
		t.Fatalf("expected fallback for dot, got %q", got)
	}
	if got := safeBaseFilename(string(filepath.Separator), "fallback.txt"); got != "fallback.txt" {
		t.Fatalf("expected fallback for separator, got %q", got)
	}
}

func TestSaveFileDialogWithE2E_Override(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(e2eDialogDirEnv, dir)

	overridePath := filepath.Join(dir, e2eSaveOverrideFile)
	if err := os.WriteFile(overridePath, []byte("/tmp/output.yaml"), 0o644); err != nil {
		t.Fatalf("write override: %v", err)
	}

	app := &App{}
	got, err := app.saveFileDialogWithE2E(runtime.SaveDialogOptions{DefaultFilename: "ignored.txt"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "/tmp/output.yaml" {
		t.Fatalf("expected override path, got %q", got)
	}
	if _, err := os.Stat(overridePath); !os.IsNotExist(err) {
		t.Fatalf("expected override file removed")
	}

	lastPath := filepath.Join(dir, e2eLastSavePathFile)
	b, err := os.ReadFile(lastPath)
	if err != nil {
		t.Fatalf("expected last save file: %v", err)
	}
	if string(b) != "/tmp/output.yaml" {
		t.Fatalf("unexpected last save content: %q", string(b))
	}
}

func TestSaveFileDialogWithE2E_Default(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(e2eDialogDirEnv, dir)

	app := &App{}
	got, err := app.saveFileDialogWithE2E(runtime.SaveDialogOptions{DefaultFilename: " ../report.txt "})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cleanGot := filepath.Clean(got)
	cleanDir := filepath.Clean(dir)
	if wantSuffix := filepath.Join("saves", "report.txt"); !strings.HasPrefix(cleanGot, cleanDir) || !strings.HasSuffix(cleanGot, wantSuffix) {
		t.Fatalf("unexpected path: %q", got)
	}

	if _, err := os.Stat(filepath.Join(dir, "saves")); err != nil {
		t.Fatalf("expected saves dir: %v", err)
	}
}

func TestOpenFileDialogWithE2E_Override(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(e2eDialogDirEnv, dir)

	overridePath := filepath.Join(dir, e2eOpenOverrideFile)
	if err := os.WriteFile(overridePath, []byte("/tmp/input.yaml"), 0o644); err != nil {
		t.Fatalf("write override: %v", err)
	}

	app := &App{}
	got, err := app.openFileDialogWithE2E(runtime.OpenDialogOptions{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "/tmp/input.yaml" {
		t.Fatalf("expected override path, got %q", got)
	}
	if _, err := os.Stat(overridePath); !os.IsNotExist(err) {
		t.Fatalf("expected override file removed")
	}

	lastPath := filepath.Join(dir, e2eLastOpenPathFile)
	b, err := os.ReadFile(lastPath)
	if err != nil {
		t.Fatalf("expected last open file: %v", err)
	}
	if string(b) != "/tmp/input.yaml" {
		t.Fatalf("unexpected last open content: %q", string(b))
	}
}

func TestOpenFileDialogWithE2E_Default(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(e2eDialogDirEnv, dir)

	app := &App{}
	got, err := app.openFileDialogWithE2E(runtime.OpenDialogOptions{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "" {
		t.Fatalf("expected empty path, got %q", got)
	}

	lastPath := filepath.Join(dir, e2eLastOpenPathFile)
	b, err := os.ReadFile(lastPath)
	if err != nil {
		t.Fatalf("expected last open file: %v", err)
	}
	if string(b) != "" {
		t.Fatalf("expected empty last open content, got %q", string(b))
	}
}
