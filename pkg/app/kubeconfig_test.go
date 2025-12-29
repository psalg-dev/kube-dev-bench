package app

import (
	"os"
	"path/filepath"
	"testing"
)

const validKubeconfig = `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://localhost:6443
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-user
  name: test-context
- context:
    cluster: test-cluster
    user: admin-user
  name: admin-context
current-context: test-context
users:
- name: test-user
  user:
    token: fake-token
- name: admin-user
  user:
    token: admin-token
`

const minimalKubeconfig = `apiVersion: v1
kind: Config
contexts:
- context:
    cluster: minimal
  name: minimal-context
`

const invalidKubeconfig = `this is not valid yaml: [[[`

const emptyContextsKubeconfig = `apiVersion: v1
kind: Config
contexts: []
`

func TestGetContextsFromFile_ValidKubeconfig(t *testing.T) {
	tmpDir := t.TempDir()
	kubeconfigPath := filepath.Join(tmpDir, "kubeconfig")

	if err := os.WriteFile(kubeconfigPath, []byte(validKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write test kubeconfig: %v", err)
	}

	app := &App{}
	contexts, err := app.getContextsFromFile(kubeconfigPath)
	if err != nil {
		t.Fatalf("getContextsFromFile failed: %v", err)
	}

	if len(contexts) != 2 {
		t.Errorf("Expected 2 contexts, got %d", len(contexts))
	}

	// Check that both contexts are present
	hasTestContext := false
	hasAdminContext := false
	for _, ctx := range contexts {
		if ctx == "test-context" {
			hasTestContext = true
		}
		if ctx == "admin-context" {
			hasAdminContext = true
		}
	}

	if !hasTestContext {
		t.Error("Expected test-context to be present")
	}
	if !hasAdminContext {
		t.Error("Expected admin-context to be present")
	}
}

func TestGetContextsFromFile_MinimalKubeconfig(t *testing.T) {
	tmpDir := t.TempDir()
	kubeconfigPath := filepath.Join(tmpDir, "kubeconfig")

	if err := os.WriteFile(kubeconfigPath, []byte(minimalKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write test kubeconfig: %v", err)
	}

	app := &App{}
	contexts, err := app.getContextsFromFile(kubeconfigPath)
	if err != nil {
		t.Fatalf("getContextsFromFile failed: %v", err)
	}

	if len(contexts) != 1 {
		t.Errorf("Expected 1 context, got %d", len(contexts))
	}

	if contexts[0] != "minimal-context" {
		t.Errorf("Expected minimal-context, got %q", contexts[0])
	}
}

func TestGetContextsFromFile_InvalidYAML(t *testing.T) {
	tmpDir := t.TempDir()
	kubeconfigPath := filepath.Join(tmpDir, "kubeconfig")

	if err := os.WriteFile(kubeconfigPath, []byte(invalidKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write test kubeconfig: %v", err)
	}

	app := &App{}
	_, err := app.getContextsFromFile(kubeconfigPath)
	if err == nil {
		t.Error("Expected error for invalid YAML, got nil")
	}
}

func TestGetContextsFromFile_NonExistentFile(t *testing.T) {
	app := &App{}
	_, err := app.getContextsFromFile("/nonexistent/path/kubeconfig")
	if err == nil {
		t.Error("Expected error for non-existent file, got nil")
	}
}

func TestGetContextsFromFile_EmptyContexts(t *testing.T) {
	tmpDir := t.TempDir()
	kubeconfigPath := filepath.Join(tmpDir, "kubeconfig")

	if err := os.WriteFile(kubeconfigPath, []byte(emptyContextsKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write test kubeconfig: %v", err)
	}

	app := &App{}
	contexts, err := app.getContextsFromFile(kubeconfigPath)
	if err != nil {
		t.Fatalf("getContextsFromFile failed: %v", err)
	}

	if len(contexts) != 0 {
		t.Errorf("Expected 0 contexts, got %d", len(contexts))
	}
}

func TestSaveCustomKubeConfig_ValidContent(t *testing.T) {
	// Create a temporary home directory
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	app := &App{}
	err := app.SaveCustomKubeConfig("test-config", validKubeconfig)
	if err != nil {
		t.Fatalf("SaveCustomKubeConfig failed: %v", err)
	}

	// Verify file was created
	expectedPath := filepath.Join(tmpHome, ".kube", "config-test-config")
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Errorf("Expected file %q to exist", expectedPath)
	}

	// Verify content
	content, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("Failed to read saved file: %v", err)
	}

	if string(content) != validKubeconfig {
		t.Error("Saved content does not match original")
	}
}

func TestSaveCustomKubeConfig_InvalidContent(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	app := &App{}
	err := app.SaveCustomKubeConfig("test-config", invalidKubeconfig)
	if err == nil {
		t.Error("Expected error for invalid YAML content, got nil")
	}
}

func TestSaveCustomKubeConfig_NameSanitization(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	testCases := []struct {
		name         string
		expectedFile string
	}{
		{"test name", "config-test_name"},
		{"test/name", "config-test_name"},
		{"test\\name", "config-test_name"},
		{"config-already", "config-already"},
	}

	app := &App{}
	for _, tc := range testCases {
		err := app.SaveCustomKubeConfig(tc.name, validKubeconfig)
		if err != nil {
			t.Errorf("SaveCustomKubeConfig(%q) failed: %v", tc.name, err)
			continue
		}

		expectedPath := filepath.Join(tmpHome, ".kube", tc.expectedFile)
		if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
			t.Errorf("Expected file %q to exist for name %q", expectedPath, tc.name)
		}
	}
}

func TestSavePrimaryKubeConfig_ValidContent(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	app := &App{}
	path, err := app.SavePrimaryKubeConfig(validKubeconfig)
	if err != nil {
		t.Fatalf("SavePrimaryKubeConfig failed: %v", err)
	}

	expectedPath := filepath.Join(tmpHome, ".kube", "kubeconfig")
	if path != expectedPath {
		t.Errorf("Expected path %q, got %q", expectedPath, path)
	}

	// Verify file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Errorf("Expected file %q to exist", path)
	}

	// Verify content
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read saved file: %v", err)
	}

	if string(content) != validKubeconfig {
		t.Error("Saved content does not match original")
	}
}

func TestSavePrimaryKubeConfig_InvalidContent(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	app := &App{}
	_, err := app.SavePrimaryKubeConfig(invalidKubeconfig)
	if err == nil {
		t.Error("Expected error for invalid YAML content, got nil")
	}
}

func TestGetKubeConfigs_EmptyDirectory(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	// Create empty .kube directory
	kubeDir := filepath.Join(tmpHome, ".kube")
	if err := os.MkdirAll(kubeDir, 0755); err != nil {
		t.Fatalf("Failed to create .kube dir: %v", err)
	}

	app := &App{}
	configs, err := app.GetKubeConfigs()
	if err != nil {
		t.Fatalf("GetKubeConfigs failed: %v", err)
	}

	if len(configs) != 0 {
		t.Errorf("Expected 0 configs in empty directory, got %d", len(configs))
	}
}

func TestGetKubeConfigs_WithConfigs(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	kubeDir := filepath.Join(tmpHome, ".kube")
	if err := os.MkdirAll(kubeDir, 0755); err != nil {
		t.Fatalf("Failed to create .kube dir: %v", err)
	}

	// Create primary kubeconfig
	if err := os.WriteFile(filepath.Join(kubeDir, "kubeconfig"), []byte(validKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write primary kubeconfig: %v", err)
	}

	// Create default config
	if err := os.WriteFile(filepath.Join(kubeDir, "config"), []byte(minimalKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write default config: %v", err)
	}

	// Create custom config
	if err := os.WriteFile(filepath.Join(kubeDir, "config-custom"), []byte(minimalKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write custom config: %v", err)
	}

	app := &App{}
	configs, err := app.GetKubeConfigs()
	if err != nil {
		t.Fatalf("GetKubeConfigs failed: %v", err)
	}

	if len(configs) != 3 {
		t.Errorf("Expected 3 configs, got %d", len(configs))
	}

	// Verify primary config is found with correct name
	foundPrimary := false
	for _, cfg := range configs {
		if cfg.Name == "kubeconfig (primary)" {
			foundPrimary = true
			if len(cfg.Contexts) != 2 {
				t.Errorf("Primary kubeconfig should have 2 contexts, got %d", len(cfg.Contexts))
			}
		}
	}
	if !foundPrimary {
		t.Error("Primary kubeconfig not found in results")
	}
}

func TestGetKubeConfigs_IgnoresInvalidFiles(t *testing.T) {
	tmpHome := t.TempDir()
	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	os.Setenv("HOME", tmpHome)
	os.Setenv("USERPROFILE", tmpHome)
	defer func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
	}()

	kubeDir := filepath.Join(tmpHome, ".kube")
	if err := os.MkdirAll(kubeDir, 0755); err != nil {
		t.Fatalf("Failed to create .kube dir: %v", err)
	}

	// Create valid config
	if err := os.WriteFile(filepath.Join(kubeDir, "config"), []byte(validKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write valid config: %v", err)
	}

	// Create invalid config (should be ignored)
	if err := os.WriteFile(filepath.Join(kubeDir, "config-broken"), []byte(invalidKubeconfig), 0600); err != nil {
		t.Fatalf("Failed to write invalid config: %v", err)
	}

	app := &App{}
	configs, err := app.GetKubeConfigs()
	if err != nil {
		t.Fatalf("GetKubeConfigs failed: %v", err)
	}

	// Should only return the valid config
	if len(configs) != 1 {
		t.Errorf("Expected 1 config (invalid should be ignored), got %d", len(configs))
	}
}

func TestKubeConfigInfo_Struct(t *testing.T) {
	info := KubeConfigInfo{
		Path:     "/path/to/config",
		Name:     "test-config",
		Contexts: []string{"ctx1", "ctx2"},
	}

	if info.Path != "/path/to/config" {
		t.Errorf("Path mismatch: got %q", info.Path)
	}
	if info.Name != "test-config" {
		t.Errorf("Name mismatch: got %q", info.Name)
	}
	if len(info.Contexts) != 2 {
		t.Errorf("Contexts length mismatch: got %d", len(info.Contexts))
	}
}
