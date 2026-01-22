package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"gowails/pkg/app/holmesgpt"
)

func TestAskHolmes_NotConfigured(t *testing.T) {
	// Reset state
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := NewApp()
	_, err := app.AskHolmes("test question")
	if err == nil {
		t.Error("AskHolmes() expected error when not configured, got nil")
	}
	if err != holmesgpt.ErrNotConfigured {
		t.Errorf("AskHolmes() expected ErrNotConfigured, got %v", err)
	}
}

func TestAskHolmes_Configured(t *testing.T) {
	// Create fake Holmes server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{
				Response: "Test response from Holmes",
				QueryID:  "test-query-123",
			})
		}
	}))
	defer server.Close()

	// Configure Holmes
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}

	app := NewApp()
	app.initHolmes()

	resp, err := app.AskHolmes("test question")
	if err != nil {
		t.Fatalf("AskHolmes() unexpected error: %v", err)
	}
	if resp.Response != "Test response from Holmes" {
		t.Errorf("AskHolmes() expected 'Test response from Holmes', got %q", resp.Response)
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
	holmesConfig = holmesgpt.DefaultConfig()
}

func TestGetHolmesConfig_MasksAPIKey(t *testing.T) {
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: "http://localhost:8080",
		APIKey:   "super-secret-key",
	}
	defer func() { holmesConfig = holmesgpt.DefaultConfig() }()

	app := NewApp()
	config, err := app.GetHolmesConfig()
	if err != nil {
		t.Fatalf("GetHolmesConfig() unexpected error: %v", err)
	}

	if config.APIKey != "********" {
		t.Errorf("GetHolmesConfig() expected masked API key, got %q", config.APIKey)
	}
	if config.Endpoint != "http://localhost:8080" {
		t.Errorf("GetHolmesConfig() expected endpoint preserved, got %q", config.Endpoint)
	}
	if !config.Enabled {
		t.Error("GetHolmesConfig() expected Enabled to be true")
	}
}

func TestSetHolmesConfig_ValidationError(t *testing.T) {
	app := &App{
		configPath: filepath.Join(t.TempDir(), "config.json"),
	}

	// Enabled without endpoint should fail
	err := app.SetHolmesConfig(holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: "",
	})
	if err == nil {
		t.Error("SetHolmesConfig() expected validation error, got nil")
	}
}

func TestSetHolmesConfig_Disabled(t *testing.T) {
	tmpDir := t.TempDir()
	app := &App{
		configPath: filepath.Join(tmpDir, "config.json"),
	}

	// Set to disabled should work
	err := app.SetHolmesConfig(holmesgpt.HolmesConfigData{
		Enabled: false,
	})
	if err != nil {
		t.Fatalf("SetHolmesConfig() unexpected error: %v", err)
	}

	// Client should be nil
	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()
	if client != nil {
		t.Error("SetHolmesConfig() expected client to be nil when disabled")
	}
}

func TestSetHolmesConfig_PersistsToFile(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	app := &App{
		configPath: configPath,
	}

	// Set config
	err := app.SetHolmesConfig(holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: "http://holmes.test:8080",
		APIKey:   "test-key",
	})
	if err != nil {
		t.Fatalf("SetHolmesConfig() unexpected error: %v", err)
	}

	// Verify file was written
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("Failed to read config file: %v", err)
	}

	var savedConfig AppConfig
	if err := json.Unmarshal(data, &savedConfig); err != nil {
		t.Fatalf("Failed to unmarshal config: %v", err)
	}

	if !savedConfig.HolmesConfig.Enabled {
		t.Error("Saved config should have Holmes enabled")
	}
	if savedConfig.HolmesConfig.Endpoint != "http://holmes.test:8080" {
		t.Errorf("Saved config endpoint = %q, want %q", savedConfig.HolmesConfig.Endpoint, "http://holmes.test:8080")
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
	holmesConfig = holmesgpt.DefaultConfig()
}

func TestTestHolmesConnection_NotConfigured(t *testing.T) {
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := NewApp()
	status, err := app.TestHolmesConnection()
	if err != nil {
		t.Fatalf("TestHolmesConnection() unexpected error: %v", err)
	}
	if status.Connected {
		t.Error("TestHolmesConnection() expected Connected=false when not configured")
	}
	if status.Error == "" {
		t.Error("TestHolmesConnection() expected error message when not configured")
	}
}

func TestTestHolmesConnection_Healthy(t *testing.T) {
	// Create fake Holmes server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer server.Close()

	// Configure Holmes
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}

	app := NewApp()
	app.initHolmes()

	status, err := app.TestHolmesConnection()
	if err != nil {
		t.Fatalf("TestHolmesConnection() unexpected error: %v", err)
	}
	if !status.Connected {
		t.Error("TestHolmesConnection() expected Connected=true")
	}
	if status.Endpoint != server.URL {
		t.Errorf("TestHolmesConnection() Endpoint = %q, want %q", status.Endpoint, server.URL)
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
	holmesConfig = holmesgpt.DefaultConfig()
}

func TestTestHolmesConnection_Unhealthy(t *testing.T) {
	// Create fake Holmes server that returns 500
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	// Configure Holmes
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}

	app := NewApp()
	app.initHolmes()

	status, err := app.TestHolmesConnection()
	if err != nil {
		t.Fatalf("TestHolmesConnection() unexpected error: %v", err)
	}
	if status.Connected {
		t.Error("TestHolmesConnection() expected Connected=false for unhealthy server")
	}
	if status.Error == "" {
		t.Error("TestHolmesConnection() expected error message for unhealthy server")
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
	holmesConfig = holmesgpt.DefaultConfig()
}

func TestInitHolmes_CreatesClient(t *testing.T) {
	// Create fake Holmes server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer server.Close()

	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}

	app := NewApp()
	app.initHolmes()

	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		t.Error("initHolmes() expected client to be created")
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
	holmesConfig = holmesgpt.DefaultConfig()
}

func TestInitHolmes_SkipsWhenDisabled(t *testing.T) {
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled: false,
	}

	// Reset client first
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := NewApp()
	app.initHolmes()

	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client != nil {
		t.Error("initHolmes() expected client to be nil when disabled")
	}
}
