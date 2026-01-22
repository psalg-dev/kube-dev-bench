package app

import (
	"fmt"
	"sync"

	"gowails/pkg/app/holmesgpt"
)

// holmesClient is the HolmesGPT client instance
var holmesClient *holmesgpt.HolmesClient
var holmesMu sync.RWMutex

// holmesConfig holds the Holmes configuration
var holmesConfig = holmesgpt.DefaultConfig()

// initHolmes initializes the Holmes client if configured
func (a *App) initHolmes() {
	if holmesConfig.IsConfigured() {
		client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{
			Endpoint: holmesConfig.Endpoint,
			APIKey:   holmesConfig.APIKey,
		})
		if err != nil {
			fmt.Printf("Failed to initialize Holmes client: %v\n", err)
			return
		}
		holmesMu.Lock()
		holmesClient = client
		holmesMu.Unlock()
	}
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
		client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{
			Endpoint: config.Endpoint,
			APIKey:   config.APIKey,
		})
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
