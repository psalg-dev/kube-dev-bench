package holmesgpt

import "errors"

// Package-level errors for Holmes integration
var (
	// ErrEndpointRequired indicates that the Holmes endpoint is required but not provided
	ErrEndpointRequired = errors.New("endpoint is required when Holmes is enabled")

	// ErrInvalidResponseFormat indicates that response_format is not valid JSON
	ErrInvalidResponseFormat = errors.New("response format must be valid JSON")

	// ErrNotConfigured indicates that Holmes is not configured
	ErrNotConfigured = errors.New("Holmes is not configured")

	// ErrConnectionFailed indicates that the connection test to Holmes failed
	ErrConnectionFailed = errors.New("Holmes connection test failed")

	// ErrOpenAIKeyRequired indicates that an OpenAI API key is required for deployment
	ErrOpenAIKeyRequired = errors.New("OpenAI API key is required for deployment")

	// ErrDeploymentFailed indicates that the Holmes deployment failed
	ErrDeploymentFailed = errors.New("Holmes deployment failed")

	// ErrAlreadyDeployed indicates that Holmes is already deployed
	ErrAlreadyDeployed = errors.New("Holmes is already deployed")
)
