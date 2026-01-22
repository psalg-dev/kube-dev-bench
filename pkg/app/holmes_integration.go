package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"gowails/pkg/app/holmesgpt"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func buildHolmesClientConfig(config holmesgpt.HolmesConfigData) holmesgpt.HolmesConfig {
	clientConfig := holmesgpt.HolmesConfig{
		Endpoint: config.Endpoint,
		APIKey:   config.APIKey,
		ModelKey: config.ModelKey,
	}
	if config.ResponseFormat != "" && json.Valid([]byte(config.ResponseFormat)) {
		clientConfig.ResponseFormat = json.RawMessage(config.ResponseFormat)
	}
	return clientConfig
}

// holmesClient is the HolmesGPT client instance
var holmesClient *holmesgpt.HolmesClient
var holmesMu sync.RWMutex

var holmesStreamCancels = map[string]context.CancelFunc{}
var holmesStreamMu sync.Mutex

// holmesConfig holds the Holmes configuration
var holmesConfig = holmesgpt.DefaultConfig()

// isInClusterEndpoint checks if the endpoint is a Kubernetes in-cluster DNS name
// which won't work from a desktop app running outside the cluster
func isInClusterEndpoint(endpoint string) bool {
	return strings.Contains(endpoint, ".svc.cluster.local")
}

// initHolmes initializes the Holmes client if configured
// If the endpoint is an in-cluster URL, it will try to establish a port-forward
func (a *App) initHolmes() {
	if !holmesConfig.IsConfigured() {
		return
	}

	endpoint := holmesConfig.Endpoint

	// If the endpoint is an in-cluster URL, try to establish port-forward
	if isInClusterEndpoint(endpoint) {
		fmt.Printf("Holmes endpoint %s is in-cluster, attempting port-forward...\n", endpoint)
		newEndpoint, err := a.StartHolmesPortForward(holmesDefaultNamespace)
		if err != nil {
			fmt.Printf("Failed to start Holmes port-forward: %v\n", err)
			fmt.Printf("Holmes will not be available until you click Reconnect in the UI\n")
			return
		}
		endpoint = newEndpoint
		holmesConfig.Endpoint = endpoint
		_ = a.saveConfig() // Save the new localhost endpoint
		fmt.Printf("Holmes port-forward established: %s\n", endpoint)
	}

	client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(holmesConfig))
	if err != nil {
		fmt.Printf("Failed to initialize Holmes client: %v\n", err)
		return
	}
	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()
}

// AskHolmes sends a question to HolmesGPT and returns the response.
// This is a Wails RPC method callable from the frontend.
func (a *App) AskHolmes(question string) (*holmesgpt.HolmesResponse, error) {
	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		return nil, holmesgpt.ErrNotConfigured
	}

	return client.Ask(question)
}

// AskHolmesStream streams a question to HolmesGPT and emits SSE events to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AskHolmesStream(question string, streamID string) error {
	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		return holmesgpt.ErrNotConfigured
	}
	if a.ctx == nil {
		return fmt.Errorf("app context not initialized")
	}

	ctx, cancel := context.WithCancel(context.Background())
	if streamID != "" {
		holmesStreamMu.Lock()
		holmesStreamCancels[streamID] = cancel
		holmesStreamMu.Unlock()
	}

	go func() {
		defer func() {
			if streamID != "" {
				holmesStreamMu.Lock()
				delete(holmesStreamCancels, streamID)
				holmesStreamMu.Unlock()
			}
		}()

		err := client.StreamAsk(ctx, question, func(event string, data []byte) error {
			payload := holmesgpt.HolmesStreamEvent{
				StreamID: streamID,
				Event:    event,
				Data:     string(data),
			}
			wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
			return nil
		})
		if err != nil {
			if errors.Is(err, context.Canceled) {
				payload := holmesgpt.HolmesStreamEvent{
					StreamID: streamID,
					Event:    "stream_end",
				}
				wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
				return
			}
			payload := holmesgpt.HolmesStreamEvent{
				StreamID: streamID,
				Event:    "error",
				Error:    err.Error(),
			}
			wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
			return
		}

		payload := holmesgpt.HolmesStreamEvent{
			StreamID: streamID,
			Event:    "stream_end",
		}
		wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
	}()

	return nil
}

// CancelHolmesStream stops a running HolmesGPT stream by stream ID.
// This is a Wails RPC method callable from the frontend.
func (a *App) CancelHolmesStream(streamID string) error {
	if streamID == "" {
		return nil
	}

	holmesStreamMu.Lock()
	cancel, ok := holmesStreamCancels[streamID]
	if ok {
		delete(holmesStreamCancels, streamID)
	}
	holmesStreamMu.Unlock()

	if ok {
		cancel()
	}

	return nil
}

// GetHolmesConfig returns the current Holmes configuration.
// The API key is masked for security.
// This is a Wails RPC method callable from the frontend.
func (a *App) GetHolmesConfig() (*holmesgpt.HolmesConfigData, error) {
	masked := holmesConfig.MaskAPIKey()
	return &masked, nil
}

// SetHolmesConfig updates the Holmes configuration.
// This is a Wails RPC method callable from the frontend.
func (a *App) SetHolmesConfig(config holmesgpt.HolmesConfigData) error {
	// Validate the configuration
	if err := config.Validate(); err != nil {
		return err
	}

	// Update the configuration
	holmesConfig = config

	// Save to persistent storage
	if err := a.saveConfig(); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Reinitialize the client
	if config.IsConfigured() {
		client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(config))
		if err != nil {
			return fmt.Errorf("failed to create Holmes client: %w", err)
		}

		holmesMu.Lock()
		holmesClient = client
		holmesMu.Unlock()
	} else {
		holmesMu.Lock()
		holmesClient = nil
		holmesMu.Unlock()
	}

	return nil
}

// ClearHolmesConfig resets the Holmes configuration to default (unconfigured) state.
// This is a Wails RPC method callable from the frontend.
func (a *App) ClearHolmesConfig() error {
	// Reset to default (unconfigured)
	holmesConfig = holmesgpt.DefaultConfig()

	// Clear the client
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	// Save to persistent storage
	if err := a.saveConfig(); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	return nil
}

// TestHolmesConnection tests the connection to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) TestHolmesConnection() (*holmesgpt.HolmesConnectionStatus, error) {
	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Error:     "Holmes is not configured",
		}, nil
	}

	err := client.TestConnection()
	if err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Endpoint:  client.GetEndpoint(),
			Error:     err.Error(),
		}, nil
	}

	return &holmesgpt.HolmesConnectionStatus{
		Connected: true,
		Endpoint:  client.GetEndpoint(),
	}, nil
}

// ReconnectHolmes attempts to re-establish the port-forward to Holmes and update the endpoint.
// This is useful when the app restarts or connection is lost.
// This is a Wails RPC method callable from the frontend.
func (a *App) ReconnectHolmes() (*holmesgpt.HolmesConnectionStatus, error) {
	// Try to start/re-establish port-forward
	endpoint, err := a.StartHolmesPortForward(holmesDefaultNamespace)
	if err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Error:     fmt.Sprintf("failed to establish port-forward: %v", err),
		}, nil
	}

	// Update the configuration with the new endpoint
	holmesConfig.Endpoint = endpoint
	holmesConfig.Enabled = true

	// Create/update the client with the new endpoint
	client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(holmesConfig))
	if err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Endpoint:  endpoint,
			Error:     fmt.Sprintf("failed to create Holmes client: %v", err),
		}, nil
	}

	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()

	// Save the updated config
	_ = a.saveConfig()

	// Test the connection
	if err := client.TestConnection(); err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Endpoint:  endpoint,
			Error:     fmt.Sprintf("connection test failed: %v", err),
		}, nil
	}

	return &holmesgpt.HolmesConnectionStatus{
		Connected: true,
		Endpoint:  endpoint,
	}, nil
}
