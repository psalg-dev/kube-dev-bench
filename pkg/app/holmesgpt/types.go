// Package holmesgpt provides an HTTP client for the HolmesGPT AI troubleshooting API.
package holmesgpt

import (
	"encoding/json"
	"time"
)

// HolmesRequest represents a query to HolmesGPT
type HolmesRequest struct {
	Ask                    string          `json:"ask"`
	Model                  string          `json:"model,omitempty"`
	Stream                 bool            `json:"stream,omitempty"`
	ResponseFormat         json.RawMessage `json:"response_format,omitempty"`
	AdditionalSystemPrompt string          `json:"additional_system_prompt,omitempty"`
}

// HolmesResponse represents the response from HolmesGPT
type HolmesResponse struct {
	Response   string                 `json:"response"`
	Analysis   string                 `json:"analysis,omitempty"`
	RichOutput map[string]interface{} `json:"rich_output,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	QueryID    string                 `json:"query_id,omitempty"`
}

// HolmesStreamEvent represents a streaming event payload emitted to the frontend
type HolmesStreamEvent struct {
	StreamID string `json:"stream_id,omitempty"`
	Event    string `json:"event"`
	Data     string `json:"data,omitempty"`
	Error    string `json:"error,omitempty"`
}

// HolmesConnectionStatus represents the connection status to HolmesGPT
type HolmesConnectionStatus struct {
	Connected bool   `json:"connected"`
	Endpoint  string `json:"endpoint"`
	Error     string `json:"error,omitempty"`
}

// HolmesConfigData represents Holmes configuration (for AppConfig persistence)
type HolmesConfigData struct {
	Enabled        bool   `json:"enabled"`
	Endpoint       string `json:"endpoint"`
	APIKey         string `json:"apiKey,omitempty"`
	ModelKey       string `json:"modelKey,omitempty"`
	ResponseFormat string `json:"responseFormat,omitempty"`
}

// HolmesDeploymentRequest contains parameters for deploying HolmesGPT to a cluster
type HolmesDeploymentRequest struct {
	OpenAIKey   string `json:"openAIKey"`
	Namespace   string `json:"namespace,omitempty"`   // defaults to "holmesgpt"
	ReleaseName string `json:"releaseName,omitempty"` // defaults to "holmesgpt"
}

// HolmesDeploymentStatus represents the status of HolmesGPT deployment
type HolmesDeploymentStatus struct {
	Phase       string `json:"phase"`       // "not_deployed", "deploying", "deployed", "failed", "checking"
	Message     string `json:"message"`     // Human-readable status message
	Progress    int    `json:"progress"`    // 0-100 progress percentage
	Endpoint    string `json:"endpoint"`    // The detected Holmes endpoint if deployed
	Error       string `json:"error"`       // Error message if failed
	ReleaseName string `json:"releaseName"` // Helm release name
	Namespace   string `json:"namespace"`   // Deployment namespace
}

// Deployment phase constants
const (
	DeploymentPhaseNotDeployed = "not_deployed"
	DeploymentPhaseDeploying   = "deploying"
	DeploymentPhaseDeployed    = "deployed"
	DeploymentPhaseFailed      = "failed"
	DeploymentPhaseChecking    = "checking"
)
