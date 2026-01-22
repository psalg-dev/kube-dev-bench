package holmesgpt

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// HolmesConfig holds configuration for creating a HolmesClient
type HolmesConfig struct {
	Endpoint string
	APIKey   string
	Timeout  time.Duration
}

// HolmesClient is an HTTP client for the HolmesGPT API
type HolmesClient struct {
	endpoint   string
	apiKey     string
	httpClient *http.Client
}

// NewHolmesClient creates a new HolmesClient with the given configuration
func NewHolmesClient(config HolmesConfig) (*HolmesClient, error) {
	if config.Endpoint == "" {
		return nil, fmt.Errorf("holmes endpoint is required")
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &HolmesClient{
		endpoint: config.Endpoint,
		apiKey:   config.APIKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Ask sends a question to HolmesGPT and returns the response
func (c *HolmesClient) Ask(question string) (*HolmesResponse, error) {
	reqBody := HolmesRequest{
		Ask:   question,
		Model: "", // Use Holmes default
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", c.endpoint+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("holmes API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var holmesResp HolmesResponse
	if err := json.NewDecoder(resp.Body).Decode(&holmesResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Set timestamp if not provided by API
	if holmesResp.Timestamp.IsZero() {
		holmesResp.Timestamp = time.Now()
	}

	return &holmesResp, nil
}

// TestConnection tests the connection to HolmesGPT by calling the health endpoint
func (c *HolmesClient) TestConnection() error {
	req, err := http.NewRequest("GET", c.endpoint+"/healthz", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}

// GetEndpoint returns the configured endpoint URL
func (c *HolmesClient) GetEndpoint() string {
	return c.endpoint
}
