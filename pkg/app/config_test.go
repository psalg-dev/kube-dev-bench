package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestAppConfig_MarshalUnmarshal(t *testing.T) {
	original := AppConfig{
		CurrentContext:      "test-context",
		CurrentNamespace:    "test-ns",
		PreferredNamespaces: []string{"ns1", "ns2", "ns3"},
		RememberContext:     true,
		RememberNamespace:   false,
		KubeConfigPath:      "/path/to/kubeconfig",
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}

	var restored AppConfig
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Failed to unmarshal config: %v", err)
	}

	if restored.CurrentContext != original.CurrentContext {
		t.Errorf("CurrentContext mismatch: got %q, want %q", restored.CurrentContext, original.CurrentContext)
	}
	if restored.CurrentNamespace != original.CurrentNamespace {
		t.Errorf("CurrentNamespace mismatch: got %q, want %q", restored.CurrentNamespace, original.CurrentNamespace)
	}
	if len(restored.PreferredNamespaces) != len(original.PreferredNamespaces) {
		t.Errorf("PreferredNamespaces length mismatch: got %d, want %d", len(restored.PreferredNamespaces), len(original.PreferredNamespaces))
	}
	for i, ns := range original.PreferredNamespaces {
		if restored.PreferredNamespaces[i] != ns {
			t.Errorf("PreferredNamespaces[%d] mismatch: got %q, want %q", i, restored.PreferredNamespaces[i], ns)
		}
	}
	if restored.RememberContext != original.RememberContext {
		t.Errorf("RememberContext mismatch: got %v, want %v", restored.RememberContext, original.RememberContext)
	}
	if restored.RememberNamespace != original.RememberNamespace {
		t.Errorf("RememberNamespace mismatch: got %v, want %v", restored.RememberNamespace, original.RememberNamespace)
	}
	if restored.KubeConfigPath != original.KubeConfigPath {
		t.Errorf("KubeConfigPath mismatch: got %q, want %q", restored.KubeConfigPath, original.KubeConfigPath)
	}
}

func TestAppConfig_EmptyValues(t *testing.T) {
	original := AppConfig{}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal empty config: %v", err)
	}

	var restored AppConfig
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Failed to unmarshal empty config: %v", err)
	}

	if restored.CurrentContext != "" {
		t.Errorf("Expected empty CurrentContext, got %q", restored.CurrentContext)
	}
	if restored.PreferredNamespaces != nil && len(restored.PreferredNamespaces) != 0 {
		t.Errorf("Expected nil/empty PreferredNamespaces, got %v", restored.PreferredNamespaces)
	}
}

func TestAppConfig_JSONFieldNames(t *testing.T) {
	// Verify JSON field names match expectations
	config := AppConfig{
		CurrentContext:      "ctx",
		CurrentNamespace:    "ns",
		PreferredNamespaces: []string{"a", "b"},
		RememberContext:     true,
		RememberNamespace:   true,
		KubeConfigPath:      "/path",
	}

	data, _ := json.Marshal(config)
	jsonStr := string(data)

	expectedFields := []string{
		`"currentContext"`,
		`"currentNamespace"`,
		`"preferredNamespaces"`,
		`"rememberContext"`,
		`"rememberNamespace"`,
		`"kubeConfigPath"`,
	}

	for _, field := range expectedFields {
		if !contains(jsonStr, field) {
			t.Errorf("Expected JSON field %s not found in: %s", field, jsonStr)
		}
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestLoadConfig_NonExistentFile(t *testing.T) {
	tmpDir := t.TempDir()
	app := &App{
		configPath: filepath.Join(tmpDir, "nonexistent.json"),
	}

	err := app.loadConfig()
	if err != nil {
		t.Errorf("Expected no error for non-existent config, got: %v", err)
	}
}

func TestLoadConfig_ValidFile(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	config := AppConfig{
		CurrentContext:      "test-ctx",
		CurrentNamespace:    "test-ns",
		PreferredNamespaces: []string{"ns1", "ns2"},
		RememberContext:     true,
		RememberNamespace:   true,
		KubeConfigPath:      "/test/path",
	}

	data, _ := json.Marshal(config)
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	app := &App{
		configPath: configPath,
	}

	if err := app.loadConfig(); err != nil {
		t.Fatalf("loadConfig failed: %v", err)
	}

	if app.currentKubeContext != "test-ctx" {
		t.Errorf("currentKubeContext mismatch: got %q, want %q", app.currentKubeContext, "test-ctx")
	}
	if app.currentNamespace != "test-ns" {
		t.Errorf("currentNamespace mismatch: got %q, want %q", app.currentNamespace, "test-ns")
	}
	if len(app.preferredNamespaces) != 2 {
		t.Errorf("preferredNamespaces length mismatch: got %d, want 2", len(app.preferredNamespaces))
	}
	if app.rememberContext != true {
		t.Errorf("rememberContext mismatch: got %v, want true", app.rememberContext)
	}
	if app.rememberNamespace != true {
		t.Errorf("rememberNamespace mismatch: got %v, want true", app.rememberNamespace)
	}
	if app.kubeConfig != "/test/path" {
		t.Errorf("kubeConfig mismatch: got %q, want %q", app.kubeConfig, "/test/path")
	}
}

func TestLoadConfig_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	if err := os.WriteFile(configPath, []byte("not valid json"), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	app := &App{
		configPath: configPath,
	}

	err := app.loadConfig()
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestSaveConfig_Success(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")

	app := &App{
		configPath:          configPath,
		currentKubeContext:  "saved-ctx",
		currentNamespace:    "saved-ns",
		preferredNamespaces: []string{"pref1", "pref2"},
		rememberContext:     true,
		rememberNamespace:   false,
		kubeConfig:          "/saved/path",
	}

	if err := app.saveConfig(); err != nil {
		t.Fatalf("saveConfig failed: %v", err)
	}

	// Read and verify saved content
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("Failed to read saved config: %v", err)
	}

	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		t.Fatalf("Failed to parse saved config: %v", err)
	}

	if config.CurrentContext != "saved-ctx" {
		t.Errorf("Saved CurrentContext mismatch: got %q, want %q", config.CurrentContext, "saved-ctx")
	}
	if config.CurrentNamespace != "saved-ns" {
		t.Errorf("Saved CurrentNamespace mismatch: got %q, want %q", config.CurrentNamespace, "saved-ns")
	}
	if len(config.PreferredNamespaces) != 2 {
		t.Errorf("Saved PreferredNamespaces length mismatch: got %d, want 2", len(config.PreferredNamespaces))
	}
}

func TestGetKubeConfigPath_WithExplicitPath(t *testing.T) {
	app := &App{
		kubeConfig: "/explicit/path/to/kubeconfig",
	}

	path := app.getKubeConfigPath()
	if path != "/explicit/path/to/kubeconfig" {
		t.Errorf("Expected explicit path, got: %s", path)
	}
}

func TestGetKubeConfigPath_DefaultPath(t *testing.T) {
	app := &App{
		kubeConfig: "",
	}

	path := app.getKubeConfigPath()
	home, _ := os.UserHomeDir()
	expected := filepath.Join(home, ".kube", "config")

	if path != expected {
		t.Errorf("Expected default path %q, got: %q", expected, path)
	}
}
