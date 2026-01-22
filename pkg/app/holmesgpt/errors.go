package holmesgpt

import "errors"

// Package-level errors for Holmes integration
var (
	// ErrEndpointRequired indicates that the Holmes endpoint is required but not provided
	ErrEndpointRequired = errors.New("endpoint is required when Holmes is enabled")

	// ErrNotConfigured indicates that Holmes is not configured
	ErrNotConfigured = errors.New("Holmes is not configured")

	// ErrConnectionFailed indicates that the connection test to Holmes failed
	ErrConnectionFailed = errors.New("Holmes connection test failed")
)
