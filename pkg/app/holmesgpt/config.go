package holmesgpt

// DefaultConfig returns a default Holmes configuration with disabled state
func DefaultConfig() HolmesConfigData {
	return HolmesConfigData{
		Enabled:  false,
		Endpoint: "",
		APIKey:   "",
	}
}

// Validate checks if the configuration is valid
func (c *HolmesConfigData) Validate() error {
	// If not enabled, no validation needed
	if !c.Enabled {
		return nil
	}

	// Endpoint is required when enabled
	if c.Endpoint == "" {
		return ErrEndpointRequired
	}

	return nil
}

// MaskAPIKey returns a copy of the config with the API key masked
func (c *HolmesConfigData) MaskAPIKey() HolmesConfigData {
	masked := *c
	if masked.APIKey != "" {
		masked.APIKey = "********"
	}
	return masked
}

// IsConfigured returns true if Holmes is enabled and has an endpoint configured
func (c *HolmesConfigData) IsConfigured() bool {
	return c.Enabled && c.Endpoint != ""
}
