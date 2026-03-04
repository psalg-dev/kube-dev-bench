package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSetKubeconfigPaths_ValidPaths(t *testing.T) {
	dir := t.TempDir()

	// Create two dummy kubeconfig files
	kc1 := filepath.Join(dir, "kc1")
	kc2 := filepath.Join(dir, "kc2")
	for _, p := range []string{kc1, kc2} {
		if err := os.WriteFile(p, []byte("apiVersion: v1\nkind: Config\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	a := &App{
		configPath: filepath.Join(dir, "config.json"),
	}

	if err := a.SetKubeconfigPaths([]string{kc1, kc2}); err != nil {
		t.Fatalf("SetKubeconfigPaths should succeed, got: %v", err)
	}
	if len(a.kubeconfigPaths) != 2 {
		t.Errorf("kubeconfigPaths length = %d, want 2", len(a.kubeconfigPaths))
	}
}

func TestSetKubeconfigPaths_InvalidPath(t *testing.T) {
	dir := t.TempDir()
	a := &App{
		configPath: filepath.Join(dir, "config.json"),
	}
	// Use a path inside the temp dir that definitely doesn't exist.
	fakePath := filepath.Join(dir, "this-does-not-exist-342857.yaml")
	err := a.SetKubeconfigPaths([]string{fakePath})
	if err == nil {
		t.Fatal("SetKubeconfigPaths should error for nonexistent path")
	}
}

func TestSetKubeconfigPaths_EmptyClears(t *testing.T) {
	dir := t.TempDir()
	a := &App{
		configPath:      filepath.Join(dir, "config.json"),
		kubeconfigPaths: []string{"/some/path"},
	}
	if err := a.SetKubeconfigPaths(nil); err != nil {
		t.Fatalf("SetKubeconfigPaths(nil) should succeed, got: %v", err)
	}
	if len(a.kubeconfigPaths) != 0 {
		t.Errorf("kubeconfigPaths should be empty after clearing, got %d", len(a.kubeconfigPaths))
	}
}

func TestGetKubeconfigPaths_ReturnsCopy(t *testing.T) {
	a := &App{
		kubeconfigPaths: []string{"/a", "/b"},
	}
	got := a.GetKubeconfigPaths()
	if len(got) != 2 {
		t.Fatalf("GetKubeconfigPaths() returned %d items, want 2", len(got))
	}
	// Modify the returned slice to ensure it's a copy
	got[0] = "/modified"
	if a.kubeconfigPaths[0] == "/modified" {
		t.Error("GetKubeconfigPaths should return a copy, not a reference")
	}
}

func TestDetectKubeconfigEnvPaths(t *testing.T) {
	a := &App{}

	// Save and restore KUBECONFIG
	orig := os.Getenv("KUBECONFIG")
	defer os.Setenv("KUBECONFIG", orig)

	// Set a multi-path KUBECONFIG (use OS-appropriate separator)
	sep := ":"
	if filepath.Separator == '\\' {
		sep = ";"
	}
	os.Setenv("KUBECONFIG", "/path/a"+sep+"/path/b"+sep+"/path/c")

	paths := a.DetectKubeconfigEnvPaths()
	if len(paths) != 3 {
		t.Errorf("DetectKubeconfigEnvPaths() returned %d paths, want 3", len(paths))
	}
}

func TestDetectKubeconfigEnvPaths_Empty(t *testing.T) {
	a := &App{}

	orig := os.Getenv("KUBECONFIG")
	defer os.Setenv("KUBECONFIG", orig)

	os.Setenv("KUBECONFIG", "")
	paths := a.DetectKubeconfigEnvPaths()
	if paths != nil {
		t.Errorf("DetectKubeconfigEnvPaths() should return nil for empty KUBECONFIG, got %v", paths)
	}
}

func TestConnectInsecure_EmptyContext(t *testing.T) {
	a := &App{}
	err := a.ConnectInsecure("")
	if err == nil {
		t.Error("ConnectInsecure should error with empty context")
	}
}
