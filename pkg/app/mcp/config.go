package mcp

import "fmt"

// MCPConfigData represents MCP server configuration (for AppConfig persistence)
type MCPConfigData struct {
	// Enabled is the master on/off switch for the MCP server
	Enabled bool `json:"enabled"`

	// Host is the hostname/IP to bind the HTTP server to (default: localhost)
	Host string `json:"host"`

	// Port is the port to bind the HTTP server to (default: 3000)
	Port int `json:"port"`

	// AllowDestructive enables delete/scale-to-zero operations
	AllowDestructive bool `json:"allowDestructive"`

	// RequireConfirm requires confirmation for destructive operations
	RequireConfirm bool `json:"requireConfirm"`

	// MaxLogLines limits the number of log lines returned (default: 1000)
	MaxLogLines int `json:"maxLogLines"`
}

// DefaultConfig returns the default MCP configuration with safe defaults
func DefaultConfig() MCPConfigData {
	return MCPConfigData{
		Enabled:          false, // User must explicitly enable
		Host:             "localhost",
		Port:             3000,
		AllowDestructive: false, // Blocks delete/scale-to-zero by default
		RequireConfirm:   true,  // Requires confirmation when enabled
		MaxLogLines:      1000,  // Sensible default for log output
	}
}

// Validate checks if the configuration is valid
func (c *MCPConfigData) Validate() error {
	// MaxLogLines must be within reasonable bounds
	if c.MaxLogLines < 10 {
		c.MaxLogLines = 10
	}
	if c.MaxLogLines > 50000 {
		c.MaxLogLines = 50000
	}
	// Set default host if empty
	if c.Host == "" {
		c.Host = "localhost"
	}
	// Set default port if not set
	if c.Port <= 0 || c.Port > 65535 {
		c.Port = 3000
	}
	return nil
}

// IsConfigured returns true if MCP is enabled
func (c *MCPConfigData) IsConfigured() bool {
	return c.Enabled
}

// Copy returns a copy of the configuration
func (c *MCPConfigData) Copy() MCPConfigData {
	return MCPConfigData{
		Enabled:          c.Enabled,
		Host:             c.Host,
		Port:             c.Port,
		AllowDestructive: c.AllowDestructive,
		RequireConfirm:   c.RequireConfirm,
		MaxLogLines:      c.MaxLogLines,
	}
}

// GetAddress returns the full address string (host:port)
func (c *MCPConfigData) GetAddress() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
