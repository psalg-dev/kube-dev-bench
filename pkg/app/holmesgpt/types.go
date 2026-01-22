// Package holmesgpt provides an HTTP client for the HolmesGPT AI troubleshooting API.
package holmesgpt

import "time"

// HolmesRequest represents a query to HolmesGPT
type HolmesRequest struct {
	Ask   string `json:"ask"`
	Model string `json:"model,omitempty"`
}

// HolmesResponse represents the response from HolmesGPT
type HolmesResponse struct {
	Response   string                 `json:"response"`
	RichOutput map[string]interface{} `json:"rich_output,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	QueryID    string                 `json:"query_id,omitempty"`
}

// HolmesConnectionStatus represents the connection status to HolmesGPT
type HolmesConnectionStatus struct {
	Connected bool   `json:"connected"`
	Endpoint  string `json:"endpoint"`
	Error     string `json:"error,omitempty"`
}

// HolmesConfigData represents Holmes configuration (for AppConfig persistence)
type HolmesConfigData struct {
	Enabled  bool   `json:"enabled"`
	Endpoint string `json:"endpoint"`
	APIKey   string `json:"apiKey,omitempty"`
}
