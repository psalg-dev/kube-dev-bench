package mcp

// checkSecurity validates whether an operation is allowed based on the current configuration
func (s *MCPServer) checkSecurity(tool *ToolDefinition, input map[string]interface{}) error {
	// Read-only operations are always allowed
	if tool.Security == SecuritySafe {
		return nil
	}

	// Check for scale-to-zero (destructive)
	if isScaleToZero(tool.Name, input) {
		// Block if destructive operations are disabled
		if !s.config.AllowDestructive {
			return ErrDestructiveDisabled
		}

		// Check if confirmation is required
		if s.config.RequireConfirm {
			confirmed, _ := input["confirmed"].(bool)
			if !confirmed {
				return ErrConfirmationRequired
			}
		}
	}

	// Check for other destructive operations
	if tool.Security == SecurityDestructive {
		if !s.config.AllowDestructive {
			return ErrDestructiveDisabled
		}

		if s.config.RequireConfirm {
			confirmed, _ := input["confirmed"].(bool)
			if !confirmed {
				return ErrConfirmationRequired
			}
		}
	}

	return nil
}

// isScaleToZero checks if an operation is scaling to zero replicas
func isScaleToZero(toolName string, input map[string]interface{}) bool {
	switch toolName {
	case "k8s_scale_deployment", "swarm_scale_service":
		replicas, ok := input["replicas"].(float64)
		return ok && replicas == 0
	}
	return false
}

// GetSecurityLevel returns the effective security level for a tool call
func GetSecurityLevel(toolName string, input map[string]interface{}) OperationSecurity {
	// Scaling to zero is always destructive regardless of base security level
	if isScaleToZero(toolName, input) {
		return SecurityDestructive
	}

	// Default levels for known tools
	switch toolName {
	// Read-only tools
	case "k8s_list", "k8s_describe", "k8s_get_resource_yaml",
		"k8s_get_pod_logs", "k8s_get_events", "k8s_get_resource_counts",
		"k8s_top", "k8s_rollout",
		"swarm_list", "swarm_inspect", "swarm_get_service_logs":
		return SecuritySafe

	// Write operations
	case "k8s_scale_deployment", "k8s_restart_deployment",
		"swarm_scale_service":
		return SecurityWrite

	default:
		// Unknown tools default to write for safety
		return SecurityWrite
	}
}

// AllowedOperations returns a list of operations allowed by the current config
func (s *MCPServer) AllowedOperations() []string {
	allowed := []string{"read-only operations"}

	if s.config.AllowDestructive {
		allowed = append(allowed, "write operations", "destructive operations (with confirmation)")
		if !s.config.RequireConfirm {
			allowed = append(allowed, "destructive operations (without confirmation)")
		}
	} else {
		allowed = append(allowed, "write operations (except scale-to-zero)")
	}

	return allowed
}

// IsOperationAllowed checks if a specific operation type is allowed
func (s *MCPServer) IsOperationAllowed(security OperationSecurity, confirmed bool) bool {
	switch security {
	case SecuritySafe:
		return true
	case SecurityWrite:
		return true
	case SecurityDestructive:
		if !s.config.AllowDestructive {
			return false
		}
		if s.config.RequireConfirm && !confirmed {
			return false
		}
		return true
	default:
		return false
	}
}
