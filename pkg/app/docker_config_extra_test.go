package app

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"gowails/pkg/app/docker"
)

// setTestHomeDir overrides the user home directory for the duration of the test
// and creates the KubeDevBench configuration subdirectory if create=true.
func setTestHomeDir(t *testing.T, tmpDir string, create bool) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", tmpDir)
	} else {
		t.Setenv("HOME", tmpDir)
	}
	if create {
		if err := os.MkdirAll(filepath.Join(tmpDir, "KubeDevBench"), 0o750); err != nil {
			t.Fatalf("failed to create KubeDevBench dir: %v", err)
		}
	}
}

func newDockerApp() *App {
	return &App{ctx: context.Background()}
}

// ─── saveDockerConfig ─────────────────────────────────────────────────────────

func TestSaveDockerConfig_RoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	setTestHomeDir(t, tmpDir, true)

	app := newDockerApp()
	cfg := docker.DockerConfig{
		Host:       "tcp://192.168.1.100:2376",
		TLSEnabled: true,
		TLSCert:    "/certs/cert.pem",
		TLSKey:     "/certs/key.pem",
		TLSCA:      "/certs/ca.pem",
		TLSVerify:  true,
	}

	if err := app.saveDockerConfig(cfg); err != nil {
		t.Fatalf("saveDockerConfig() error = %v", err)
	}

	// Verify file was written
	configPath := filepath.Join(tmpDir, "KubeDevBench", "docker-config.json")
	if _, err := os.Stat(configPath); err != nil {
		t.Fatalf("expected config file to exist: %v", err)
	}
}

// ─── loadDockerConfig ─────────────────────────────────────────────────────────

func TestLoadDockerConfig_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	setTestHomeDir(t, tmpDir, false) // no KubeDevBench dir → file won't exist

	app := newDockerApp()
	cfg, err := app.loadDockerConfig()
	if err != nil {
		t.Fatalf("loadDockerConfig() returned unexpected error = %v", err)
	}
	if cfg != nil {
		t.Errorf("expected nil config for missing file, got %+v", cfg)
	}
}

func TestLoadDockerConfig_AfterSave(t *testing.T) {
	tmpDir := t.TempDir()
	setTestHomeDir(t, tmpDir, true)

	app := newDockerApp()
	original := docker.DockerConfig{
		Host:       "unix:///var/run/docker.sock",
		TLSEnabled: false,
	}

	if err := app.saveDockerConfig(original); err != nil {
		t.Fatalf("saveDockerConfig() error = %v", err)
	}

	loaded, err := app.loadDockerConfig()
	if err != nil {
		t.Fatalf("loadDockerConfig() error = %v", err)
	}
	if loaded == nil {
		t.Fatal("expected non-nil loaded config")
	}
	if loaded.Host != original.Host {
		t.Errorf("host mismatch: want %q, got %q", original.Host, loaded.Host)
	}
	if loaded.TLSEnabled != original.TLSEnabled {
		t.Errorf("TLSEnabled mismatch: want %v, got %v", original.TLSEnabled, loaded.TLSEnabled)
	}
}

// ─── GetDockerConfig ──────────────────────────────────────────────────────────

func TestGetDockerConfig_DelegatesToLoad(t *testing.T) {
	tmpDir := t.TempDir()
	setTestHomeDir(t, tmpDir, false) // no config file

	app := newDockerApp()
	cfg, err := app.GetDockerConfig()
	if err != nil {
		t.Fatalf("GetDockerConfig() error = %v", err)
	}
	if cfg != nil {
		t.Errorf("expected nil for missing config, got %+v", cfg)
	}
}
