package app

import (
	"os"
	"testing"
)

func TestSetProxyConfig(t *testing.T) {
	tests := []struct {
		name        string
		proxyURL    string
		authType    string
		username    string
		password    string
		wantErr     bool
		errContains string
	}{
		{
			name:     "valid none auth type",
			proxyURL: "",
			authType: "none",
			username: "",
			password: "",
			wantErr:  false,
		},
		{
			name:     "valid basic auth type with URL",
			proxyURL: "http://proxy.example.com:8080",
			authType: "basic",
			username: "user",
			password: "pass",
			wantErr:  false,
		},
		{
			name:     "valid system auth type",
			proxyURL: "",
			authType: "system",
			username: "",
			password: "",
			wantErr:  false,
		},
		{
			name:        "invalid auth type",
			proxyURL:    "",
			authType:    "invalid",
			username:    "",
			password:    "",
			wantErr:     true,
			errContains: "invalid authType",
		},
		{
			name:     "basic auth with HTTPS proxy",
			proxyURL: "https://secure-proxy.example.com:8443",
			authType: "basic",
			username: "admin",
			password: "secret",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temp file for config persistence
			tmpFile, err := os.CreateTemp("", "proxy_test_*.json")
			if err != nil {
				t.Fatalf("Failed to create temp file: %v", err)
			}
			tmpFile.Close()
			defer os.Remove(tmpFile.Name())

			app := &App{configPath: tmpFile.Name()}
			err = app.SetProxyConfig(tt.proxyURL, tt.authType, tt.username, tt.password)

			if tt.wantErr {
				if err == nil {
					t.Errorf("SetProxyConfig() expected error but got nil")
				} else if tt.errContains != "" && !containsString(err.Error(), tt.errContains) {
					t.Errorf("SetProxyConfig() error = %v, want error containing %v", err, tt.errContains)
				}
				return
			}

			if err != nil {
				t.Errorf("SetProxyConfig() unexpected error: %v", err)
				return
			}

			// Verify configuration was set correctly
			if tt.authType == "system" {
				// System proxy clears manual settings
				if app.proxyURL != "" {
					t.Errorf("proxyURL should be empty for system proxy, got %s", app.proxyURL)
				}
			} else {
				if app.proxyURL != tt.proxyURL {
					t.Errorf("proxyURL = %s, want %s", app.proxyURL, tt.proxyURL)
				}
				if app.proxyUsername != tt.username {
					t.Errorf("proxyUsername = %s, want %s", app.proxyUsername, tt.username)
				}
				if app.proxyPassword != tt.password {
					t.Errorf("proxyPassword = %s, want %s", app.proxyPassword, tt.password)
				}
			}

			if app.proxyAuthType != tt.authType {
				t.Errorf("proxyAuthType = %s, want %s", app.proxyAuthType, tt.authType)
			}
		})
	}
}

func TestGetProxyConfig(t *testing.T) {
	app := &App{
		proxyURL:      "http://proxy.example.com:8080",
		proxyAuthType: "basic",
		proxyUsername: "user",
		proxyPassword: "secret",
	}

	config := app.GetProxyConfig()

	if config.URL != app.proxyURL {
		t.Errorf("GetProxyConfig().URL = %s, want %s", config.URL, app.proxyURL)
	}
	if config.AuthType != app.proxyAuthType {
		t.Errorf("GetProxyConfig().AuthType = %s, want %s", config.AuthType, app.proxyAuthType)
	}
	if config.Username != app.proxyUsername {
		t.Errorf("GetProxyConfig().Username = %s, want %s", config.Username, app.proxyUsername)
	}
}

func TestClearProxyConfig(t *testing.T) {
	// Create temp file for config persistence
	tmpFile, err := os.CreateTemp("", "proxy_test_*.json")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpFile.Close()
	defer os.Remove(tmpFile.Name())

	app := &App{
		configPath:    tmpFile.Name(),
		proxyURL:      "http://proxy.example.com:8080",
		proxyAuthType: "basic",
		proxyUsername: "user",
		proxyPassword: "secret",
	}

	err = app.ClearProxyConfig()
	if err != nil {
		t.Errorf("ClearProxyConfig() unexpected error: %v", err)
		return
	}

	if app.proxyURL != "" {
		t.Errorf("proxyURL should be empty after clear, got %s", app.proxyURL)
	}
	if app.proxyAuthType != "none" {
		t.Errorf("proxyAuthType should be 'none' after clear, got %s", app.proxyAuthType)
	}
	if app.proxyUsername != "" {
		t.Errorf("proxyUsername should be empty after clear, got %s", app.proxyUsername)
	}
	if app.proxyPassword != "" {
		t.Errorf("proxyPassword should be empty after clear, got %s", app.proxyPassword)
	}
}

func TestIsProxyEnabled(t *testing.T) {
	tests := []struct {
		name        string
		proxyURL    string
		authType    string
		envHTTP     string
		envHTTPS    string
		wantEnabled bool
	}{
		{
			name:        "no proxy configured",
			proxyURL:    "",
			authType:    "none",
			wantEnabled: false,
		},
		{
			name:        "manual proxy URL set",
			proxyURL:    "http://proxy.example.com:8080",
			authType:    "basic",
			wantEnabled: true,
		},
		{
			name:        "system proxy with HTTP_PROXY set",
			proxyURL:    "",
			authType:    "system",
			envHTTP:     "http://system-proxy:8080",
			wantEnabled: true,
		},
		{
			name:        "system proxy with HTTPS_PROXY set",
			proxyURL:    "",
			authType:    "system",
			envHTTPS:    "https://system-proxy:8443",
			wantEnabled: true,
		},
		{
			name:        "system proxy with no env vars",
			proxyURL:    "",
			authType:    "system",
			wantEnabled: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up environment
			os.Unsetenv("HTTP_PROXY")
			os.Unsetenv("http_proxy")
			os.Unsetenv("HTTPS_PROXY")
			os.Unsetenv("https_proxy")

			if tt.envHTTP != "" {
				os.Setenv("HTTP_PROXY", tt.envHTTP)
				defer os.Unsetenv("HTTP_PROXY")
			}
			if tt.envHTTPS != "" {
				os.Setenv("HTTPS_PROXY", tt.envHTTPS)
				defer os.Unsetenv("HTTPS_PROXY")
			}

			app := &App{
				proxyURL:      tt.proxyURL,
				proxyAuthType: tt.authType,
			}

			if got := app.IsProxyEnabled(); got != tt.wantEnabled {
				t.Errorf("IsProxyEnabled() = %v, want %v", got, tt.wantEnabled)
			}
		})
	}
}

func TestDetectSystemProxy(t *testing.T) {
	// Clear any existing proxy env vars
	os.Unsetenv("HTTP_PROXY")
	os.Unsetenv("http_proxy")
	os.Unsetenv("HTTPS_PROXY")
	os.Unsetenv("https_proxy")
	os.Unsetenv("NO_PROXY")
	os.Unsetenv("no_proxy")

	// Set test values
	os.Setenv("HTTP_PROXY", "http://test-proxy:8080")
	os.Setenv("HTTPS_PROXY", "https://test-proxy:8443")
	os.Setenv("NO_PROXY", "localhost,127.0.0.1")
	defer func() {
		os.Unsetenv("HTTP_PROXY")
		os.Unsetenv("HTTPS_PROXY")
		os.Unsetenv("NO_PROXY")
	}()

	app := &App{}
	result := app.DetectSystemProxy()

	if result["HTTP_PROXY"] != "http://test-proxy:8080" {
		t.Errorf("HTTP_PROXY = %s, want http://test-proxy:8080", result["HTTP_PROXY"])
	}
	if result["HTTPS_PROXY"] != "https://test-proxy:8443" {
		t.Errorf("HTTPS_PROXY = %s, want https://test-proxy:8443", result["HTTPS_PROXY"])
	}
	if result["NO_PROXY"] != "localhost,127.0.0.1" {
		t.Errorf("NO_PROXY = %s, want localhost,127.0.0.1", result["NO_PROXY"])
	}
}

func TestGetProxyDisplayURL(t *testing.T) {
	tests := []struct {
		name     string
		proxyURL string
		authType string
		envHTTPS string
		want     string
	}{
		{
			name:     "no proxy",
			proxyURL: "",
			authType: "none",
			want:     "",
		},
		{
			name:     "manual proxy without auth",
			proxyURL: "http://proxy.example.com:8080",
			authType: "basic",
			want:     "http://proxy.example.com:8080",
		},
		{
			name:     "manual proxy with auth - password hidden",
			proxyURL: "http://user:secret@proxy.example.com:8080",
			authType: "basic",
			want:     "http://user:***@proxy.example.com:8080",
		},
		{
			name:     "system proxy from env",
			proxyURL: "",
			authType: "system",
			envHTTPS: "https://system-proxy:8443",
			want:     "https://system-proxy:8443",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv("HTTP_PROXY")
			os.Unsetenv("HTTPS_PROXY")

			if tt.envHTTPS != "" {
				os.Setenv("HTTPS_PROXY", tt.envHTTPS)
				defer os.Unsetenv("HTTPS_PROXY")
			}

			app := &App{
				proxyURL:      tt.proxyURL,
				proxyAuthType: tt.authType,
			}

			if got := app.GetProxyDisplayURL(); got != tt.want {
				t.Errorf("GetProxyDisplayURL() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestSanitizeProxyURL(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "empty URL",
			input: "",
			want:  "",
		},
		{
			name:  "URL without credentials",
			input: "http://proxy.example.com:8080",
			want:  "http://proxy.example.com:8080",
		},
		{
			name:  "URL with user only",
			input: "http://user@proxy.example.com:8080",
			want:  "http://user@proxy.example.com:8080",
		},
		{
			name:  "URL with user and password",
			input: "http://user:password@proxy.example.com:8080",
			want:  "http://user:***@proxy.example.com:8080",
		},
		{
			name:  "HTTPS URL with credentials",
			input: "https://admin:secret123@secure-proxy.example.com:8443",
			want:  "https://admin:***@secure-proxy.example.com:8443",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sanitizeProxyURL(tt.input); got != tt.want {
				t.Errorf("sanitizeProxyURL(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestGetEnvCaseInsensitive(t *testing.T) {
	// Use a unique env var name to avoid conflicts
	testKey := "KUBEDEVBENCH_TEST_PROXY"
	testKeyLower := "kubedevbench_test_proxy"

	tests := []struct {
		name     string
		key      string
		envUpper string
		envLower string
		want     string
	}{
		{
			name:     "uppercase env var",
			key:      testKey,
			envUpper: "http://uppercase:8080",
			want:     "http://uppercase:8080",
		},
		{
			name:     "lowercase env var only",
			key:      testKey,
			envLower: "http://lowercase:8080",
			want:     "http://lowercase:8080",
		},
		{
			name: "neither set",
			key:  testKey,
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv(testKey)
			os.Unsetenv(testKeyLower)

			if tt.envUpper != "" {
				os.Setenv(testKey, tt.envUpper)
				defer os.Unsetenv(testKey)
			}
			if tt.envLower != "" {
				os.Setenv(testKeyLower, tt.envLower)
				defer os.Unsetenv(testKeyLower)
			}

			if got := getEnvCaseInsensitive(tt.key); got != tt.want {
				t.Errorf("getEnvCaseInsensitive(%q) = %q, want %q", tt.key, got, tt.want)
			}
		})
	}
}

// Helper function
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStringHelper(s, substr))
}

func containsStringHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
