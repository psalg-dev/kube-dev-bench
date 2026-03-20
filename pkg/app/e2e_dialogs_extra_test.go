package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSafeBaseFilename(t *testing.T) {
	if got := safeBaseFilename("", "fallback.txt"); got != "fallback.txt" {
		t.Fatalf("expected fallback, got %s", got)
	}
	if got := safeBaseFilename("/path/to/name.txt", "fallback"); got != "name.txt" {
		t.Fatalf("expected name.txt, got %s", got)
	}
	if got := safeBaseFilename(".", "fallback"); got != "fallback" {
		t.Fatalf("expected fallback for ., got %s", got)
	}
}

func TestDetectDialogDirFromTemp(t *testing.T) {
	fallback := filepath.Join(os.TempDir(), "kdb-e2e-dialogs")
	marker := filepath.Join(fallback, "enabled.txt")
	_ = os.MkdirAll(fallback, 0o750)
	defer func() { _ = os.RemoveAll(fallback) }()
	if err := os.WriteFile(marker, []byte("1"), 0o600); err != nil {
		t.Fatalf("failed write marker: %v", err)
	}
	if d := detectDialogDirFromTemp(); d == "" {
		t.Fatalf("expected detectDialogDirFromTemp to find fallback dir")
	}
}

func TestConsumeOneShotPath(t *testing.T) {
	d := t.TempDir()
	f := filepath.Join(d, "once.txt")
	_ = os.WriteFile(f, []byte("/tmp/save.txt"), 0o600)
	val, ok := consumeOneShotPath(d, "once.txt")
	if !ok || val != "/tmp/save.txt" {
		t.Fatalf("consumeOneShotPath failed: ok=%v val=%s", ok, val)
	}
	// file should be removed
	if _, err := os.Stat(f); err == nil {
		t.Fatalf("expected file removed")
	}
	// empty content returns true and empty string
	g := t.TempDir()
	f2 := filepath.Join(g, "e.txt")
	_ = os.WriteFile(f2, []byte("\n"), 0o600)
	val2, ok2 := consumeOneShotPath(g, "e.txt")
	if !ok2 || val2 != "" {
		t.Fatalf("expected empty value consumed, got %q ok=%v", val2, ok2)
	}
}

func TestE2EDialogDirEnvOverride(t *testing.T) {
	orig := os.Getenv(e2eDialogDirEnv)
	d := t.TempDir()
	_ = os.Setenv(e2eDialogDirEnv, d)
	defer func() { _ = os.Setenv(e2eDialogDirEnv, orig) }()
	if ed := e2eDialogDir(); ed != d {
		t.Fatalf("expected e2eDialogDir to return env dir, got %s", ed)
	}
}

func TestEnsureDir(t *testing.T) {
	d := filepath.Join(t.TempDir(), "a", "b")
	if err := ensureDir(d); err != nil {
		t.Fatalf("ensureDir failed: %v", err)
	}
	if fi, err := os.Stat(d); err != nil || !fi.IsDir() {
		t.Fatalf("expected dir created, err=%v", err)
	}
}
