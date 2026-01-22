package holmesgpt

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewHolmesClient(t *testing.T) {
	tests := []struct {
		name    string
		config  HolmesConfig
		wantErr bool
	}{
		{
			name: "valid config with endpoint",
			config: HolmesConfig{
				Endpoint: "http://localhost:8080",
			},
			wantErr: false,
		},
		{
			name: "valid config with endpoint and api key",
			config: HolmesConfig{
				Endpoint: "http://localhost:8080",
				APIKey:   "test-api-key",
			},
			wantErr: false,
		},
		{
			name: "valid config with custom timeout",
			config: HolmesConfig{
				Endpoint: "http://localhost:8080",
				Timeout:  60 * time.Second,
			},
			wantErr: false,
		},
		{
			name:    "missing endpoint",
			config:  HolmesConfig{},
			wantErr: true,
		},
		{
			name: "empty endpoint string",
			config: HolmesConfig{
				Endpoint: "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewHolmesClient(tt.config)
			if tt.wantErr {
				if err == nil {
					t.Errorf("NewHolmesClient() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("NewHolmesClient() unexpected error: %v", err)
				return
			}
			if client == nil {
				t.Errorf("NewHolmesClient() returned nil client")
			}
		})
	}
}

func TestHolmesClient_Ask(t *testing.T) {
	tests := []struct {
		name           string
		question       string
		serverResponse HolmesResponse
		serverStatus   int
		wantErr        bool
	}{
		{
			name:     "successful query",
			question: "What pods are running in the default namespace?",
			serverResponse: HolmesResponse{
				Response:  "There are 3 pods running in the default namespace: nginx, redis, and postgres.",
				Timestamp: time.Now(),
				QueryID:   "query-123",
			},
			serverStatus: http.StatusOK,
			wantErr:      false,
		},
		{
			name:     "successful query with rich output",
			question: "Show me pod metrics",
			serverResponse: HolmesResponse{
				Response: "Here are the pod metrics",
				RichOutput: map[string]interface{}{
					"graph": "base64-encoded-graph-data",
				},
				Timestamp: time.Now(),
			},
			serverStatus: http.StatusOK,
			wantErr:      false,
		},
		{
			name:           "server error",
			question:       "test question",
			serverResponse: HolmesResponse{},
			serverStatus:   http.StatusInternalServerError,
			wantErr:        true,
		},
		{
			name:           "bad request",
			question:       "test question",
			serverResponse: HolmesResponse{},
			serverStatus:   http.StatusBadRequest,
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fake HTTP server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify request path
				if r.URL.Path != "/api/chat" {
					t.Errorf("Expected /api/chat, got %s", r.URL.Path)
				}

				// Verify method
				if r.Method != "POST" {
					t.Errorf("Expected POST, got %s", r.Method)
				}

				// Verify content type
				if r.Header.Get("Content-Type") != "application/json" {
					t.Errorf("Expected Content-Type: application/json, got %s", r.Header.Get("Content-Type"))
				}

				// Decode request body
				var req HolmesRequest
				if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
					t.Errorf("Failed to decode request body: %v", err)
				}
				if req.Ask != tt.question {
					t.Errorf("Expected question %q, got %q", tt.question, req.Ask)
				}

				w.WriteHeader(tt.serverStatus)
				if tt.serverStatus == http.StatusOK {
					json.NewEncoder(w).Encode(tt.serverResponse)
				} else {
					w.Write([]byte("error message"))
				}
			}))
			defer server.Close()

			client, err := NewHolmesClient(HolmesConfig{
				Endpoint: server.URL,
			})
			if err != nil {
				t.Fatalf("Failed to create client: %v", err)
			}

			resp, err := client.Ask(tt.question)
			if tt.wantErr {
				if err == nil {
					t.Errorf("Ask() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("Ask() unexpected error: %v", err)
				return
			}

			if resp.Response != tt.serverResponse.Response {
				t.Errorf("Expected response %q, got %q", tt.serverResponse.Response, resp.Response)
			}
		})
	}
}

func TestHolmesClient_Ask_WithAPIKey(t *testing.T) {
	expectedAPIKey := "test-bearer-token"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify Authorization header
		auth := r.Header.Get("Authorization")
		expectedAuth := "Bearer " + expectedAPIKey
		if auth != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, auth)
		}

		json.NewEncoder(w).Encode(HolmesResponse{
			Response: "test response",
		})
	}))
	defer server.Close()

	client, err := NewHolmesClient(HolmesConfig{
		Endpoint: server.URL,
		APIKey:   expectedAPIKey,
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	_, err = client.Ask("test question")
	if err != nil {
		t.Errorf("Ask() unexpected error: %v", err)
	}
}

func TestHolmesClient_TestConnection(t *testing.T) {
	tests := []struct {
		name         string
		serverStatus int
		wantErr      bool
	}{
		{
			name:         "healthy connection",
			serverStatus: http.StatusOK,
			wantErr:      false,
		},
		{
			name:         "unhealthy connection",
			serverStatus: http.StatusServiceUnavailable,
			wantErr:      true,
		},
		{
			name:         "server error",
			serverStatus: http.StatusInternalServerError,
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/healthz" {
					t.Errorf("Expected /healthz, got %s", r.URL.Path)
				}
				if r.Method != "GET" {
					t.Errorf("Expected GET, got %s", r.Method)
				}
				w.WriteHeader(tt.serverStatus)
			}))
			defer server.Close()

			client, err := NewHolmesClient(HolmesConfig{
				Endpoint: server.URL,
			})
			if err != nil {
				t.Fatalf("Failed to create client: %v", err)
			}

			err = client.TestConnection()
			if tt.wantErr {
				if err == nil {
					t.Errorf("TestConnection() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("TestConnection() unexpected error: %v", err)
			}
		})
	}
}

func TestHolmesClient_TestConnection_NetworkError(t *testing.T) {
	client, err := NewHolmesClient(HolmesConfig{
		Endpoint: "http://localhost:99999", // Invalid port
		Timeout:  100 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	err = client.TestConnection()
	if err == nil {
		t.Errorf("TestConnection() expected error for unreachable server")
	}
}

func TestHolmesClient_GetEndpoint(t *testing.T) {
	endpoint := "http://holmes.example.com:8080"
	client, err := NewHolmesClient(HolmesConfig{
		Endpoint: endpoint,
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	if client.GetEndpoint() != endpoint {
		t.Errorf("GetEndpoint() expected %q, got %q", endpoint, client.GetEndpoint())
	}
}

func TestHolmesConfigData_Validate(t *testing.T) {
	tests := []struct {
		name    string
		config  HolmesConfigData
		wantErr bool
	}{
		{
			name: "disabled config is always valid",
			config: HolmesConfigData{
				Enabled:  false,
				Endpoint: "",
			},
			wantErr: false,
		},
		{
			name: "enabled with endpoint is valid",
			config: HolmesConfigData{
				Enabled:  true,
				Endpoint: "http://localhost:8080",
			},
			wantErr: false,
		},
		{
			name: "enabled without endpoint is invalid",
			config: HolmesConfigData{
				Enabled:  true,
				Endpoint: "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				if err == nil {
					t.Errorf("Validate() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("Validate() unexpected error: %v", err)
			}
		})
	}
}

func TestHolmesConfigData_MaskAPIKey(t *testing.T) {
	tests := []struct {
		name     string
		config   HolmesConfigData
		expected string
	}{
		{
			name: "masks non-empty API key",
			config: HolmesConfigData{
				Enabled:  true,
				Endpoint: "http://localhost:8080",
				APIKey:   "super-secret-key",
			},
			expected: "********",
		},
		{
			name: "empty API key stays empty",
			config: HolmesConfigData{
				Enabled:  true,
				Endpoint: "http://localhost:8080",
				APIKey:   "",
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			masked := tt.config.MaskAPIKey()
			if masked.APIKey != tt.expected {
				t.Errorf("MaskAPIKey() expected APIKey=%q, got %q", tt.expected, masked.APIKey)
			}
			// Ensure other fields are preserved
			if masked.Enabled != tt.config.Enabled {
				t.Errorf("MaskAPIKey() changed Enabled field")
			}
			if masked.Endpoint != tt.config.Endpoint {
				t.Errorf("MaskAPIKey() changed Endpoint field")
			}
		})
	}
}

func TestHolmesConfigData_IsConfigured(t *testing.T) {
	tests := []struct {
		name     string
		config   HolmesConfigData
		expected bool
	}{
		{
			name: "enabled with endpoint is configured",
			config: HolmesConfigData{
				Enabled:  true,
				Endpoint: "http://localhost:8080",
			},
			expected: true,
		},
		{
			name: "disabled is not configured",
			config: HolmesConfigData{
				Enabled:  false,
				Endpoint: "http://localhost:8080",
			},
			expected: false,
		},
		{
			name: "enabled without endpoint is not configured",
			config: HolmesConfigData{
				Enabled:  true,
				Endpoint: "",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.config.IsConfigured(); got != tt.expected {
				t.Errorf("IsConfigured() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()
	if config.Enabled {
		t.Errorf("DefaultConfig() Enabled should be false")
	}
	if config.Endpoint != "" {
		t.Errorf("DefaultConfig() Endpoint should be empty")
	}
	if config.APIKey != "" {
		t.Errorf("DefaultConfig() APIKey should be empty")
	}
}
