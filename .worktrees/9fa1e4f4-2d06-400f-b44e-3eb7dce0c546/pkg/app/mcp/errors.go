package mcp

import "errors"

// Package-level errors for MCP integration
var (
	// ErrNotConfigured indicates that MCP is not configured
	ErrNotConfigured = errors.New("MCP server is not configured")

	// ErrDestructiveDisabled indicates that destructive operations are disabled
	ErrDestructiveDisabled = errors.New("destructive operations are disabled in MCP configuration")

	// ErrConfirmationRequired indicates that confirmation is required for this operation
	ErrConfirmationRequired = errors.New("confirmation required for destructive operation")

	// ErrServerNotRunning indicates that the MCP server is not running
	ErrServerNotRunning = errors.New("MCP server is not running")

	// ErrServerAlreadyRunning indicates that the MCP server is already running
	ErrServerAlreadyRunning = errors.New("MCP server is already running")

	// ErrInvalidInput indicates that the tool input is invalid
	ErrInvalidInput = errors.New("invalid tool input parameters")

	// ErrToolNotFound indicates that the requested tool was not found
	ErrToolNotFound = errors.New("tool not found")

	// ErrResourceNotFound indicates that the requested resource was not found
	ErrResourceNotFound = errors.New("resource not found")
)
