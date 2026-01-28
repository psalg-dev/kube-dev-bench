package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestNewApp(t *testing.T) {
	app := NewApp()
	if app == nil {
		t.Fatal("NewApp() returned nil")
	}

	// Verify logCancels is initialized
	if app.logCancels == nil {
		t.Error("logCancels should be initialized")
	}

	// Verify isInsecureConnection defaults to false
	if app.isInsecureConnection {
		t.Error("isInsecureConnection should default to false")
	}
}

func TestCopyFile_Success(t *testing.T) {
	tmpDir := t.TempDir()
	srcPath := filepath.Join(tmpDir, "src.txt")
	dstPath := filepath.Join(tmpDir, "subdir", "dst.txt")

	content := "test file content"
	if err := os.WriteFile(srcPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to write source file: %v", err)
	}

	if err := copyFile(srcPath, dstPath); err != nil {
		t.Fatalf("copyFile failed: %v", err)
	}

	// Verify destination file exists and has correct content
	data, err := os.ReadFile(dstPath)
	if err != nil {
		t.Fatalf("Failed to read destination file: %v", err)
	}
	if string(data) != content {
		t.Errorf("Content mismatch: got %q, want %q", string(data), content)
	}
}

func TestCopyFile_NonExistentSource(t *testing.T) {
	tmpDir := t.TempDir()
	srcPath := filepath.Join(tmpDir, "nonexistent.txt")
	dstPath := filepath.Join(tmpDir, "dst.txt")

	err := copyFile(srcPath, dstPath)
	if err == nil {
		t.Error("Expected error for non-existent source file")
	}
}

func TestGetCurrentConfig(t *testing.T) {
	app := &App{
		currentKubeContext:  "test-context",
		currentNamespace:    "test-namespace",
		preferredNamespaces: []string{"ns1", "ns2"},
	}

	config := app.GetCurrentConfig()

	if config.CurrentContext != "test-context" {
		t.Errorf("CurrentContext = %q, want %q", config.CurrentContext, "test-context")
	}
	if config.CurrentNamespace != "test-namespace" {
		t.Errorf("CurrentNamespace = %q, want %q", config.CurrentNamespace, "test-namespace")
	}
	if len(config.PreferredNamespaces) != 2 {
		t.Errorf("PreferredNamespaces length = %d, want 2", len(config.PreferredNamespaces))
	}
}

func TestGetCurrentConfig_Empty(t *testing.T) {
	app := &App{}

	config := app.GetCurrentConfig()

	if config.CurrentContext != "" {
		t.Errorf("CurrentContext should be empty, got %q", config.CurrentContext)
	}
	if config.CurrentNamespace != "" {
		t.Errorf("CurrentNamespace should be empty, got %q", config.CurrentNamespace)
	}
	if config.PreferredNamespaces != nil && len(config.PreferredNamespaces) != 0 {
		t.Errorf("PreferredNamespaces should be nil or empty")
	}
}

func TestGreet(t *testing.T) {
	app := &App{}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"simple name", "World", "Hello World, It's show time!"},
		{"empty name", "", "Hello , It's show time!"},
		{"name with space", "John Doe", "Hello John Doe, It's show time!"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := app.Greet(tc.input)
			if result != tc.expected {
				t.Errorf("Greet(%q) = %q, want %q", tc.input, result, tc.expected)
			}
		})
	}
}

func TestStartup_LoadsConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	// Create a config file
	configContent := `{"currentContext":"startup-ctx","currentNamespace":"startup-ns"}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	app := &App{
		configPath:           configPath,
		countsRefreshCh:      make(chan struct{}, 1),
		disableStartupDocker: true,
	}

	ctx := context.Background()
	app.Startup(ctx)

	if app.ctx != ctx {
		t.Error("Context was not set")
	}
	if app.currentKubeContext != "startup-ctx" {
		t.Errorf("currentKubeContext = %q, want %q", app.currentKubeContext, "startup-ctx")
	}
	if app.currentNamespace != "startup-ns" {
		t.Errorf("currentNamespace = %q, want %q", app.currentNamespace, "startup-ns")
	}
}

func TestGetCurrentConfig_PreferredNamespacesCopy(t *testing.T) {
	// Verify that GetCurrentConfig returns a copy, not a reference
	app := &App{
		preferredNamespaces: []string{"ns1", "ns2"},
	}

	config1 := app.GetCurrentConfig()
	config1.PreferredNamespaces[0] = "modified"

	config2 := app.GetCurrentConfig()
	if config2.PreferredNamespaces[0] != "ns1" {
		t.Error("GetCurrentConfig should return a copy of PreferredNamespaces")
	}
}

func TestShutdown_CancelsActiveLogStreams(t *testing.T) {
	ctx := context.Background()
	_, cancelA := context.WithCancel(ctx)
	_, cancelB := context.WithCancel(ctx)

	called := 0
	app := &App{
		logCancels: map[string]context.CancelFunc{
			"a":   func() { called++; cancelA() },
			"b":   func() { called++; cancelB() },
			"nil": nil,
		},
	}

	app.Shutdown(ctx)

	if called != 2 {
		t.Fatalf("expected 2 cancels, got %d", called)
	}
	if len(app.logCancels) != 0 {
		t.Fatalf("expected logCancels to be cleared, got %d", len(app.logCancels))
	}
}
