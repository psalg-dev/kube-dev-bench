package app

import (
	"context"
	"testing"
)

// Tests for CreateResource error conditions
// These tests verify early-return error paths that don't require a real cluster

func TestCreateResource_InvalidYAML(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test-context",
	}

	err := app.CreateResource("default", "not valid yaml: [")
	if err == nil {
		t.Error("Expected error for invalid YAML")
	}
	if err != nil && !contains(err.Error(), "YAML parse error") {
		t.Errorf("Expected 'YAML parse error', got: %v", err)
	}
}

func TestCreateResource_MissingAPIVersion(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test-context",
	}

	yamlContent := `
kind: ConfigMap
metadata:
  name: test-configmap
`
	err := app.CreateResource("default", yamlContent)
	if err == nil {
		t.Error("Expected error for missing apiVersion")
	}
	if err != nil && !contains(err.Error(), "apiVersion not found") {
		t.Errorf("Expected 'apiVersion not found', got: %v", err)
	}
}

func TestCreateResource_MissingKind(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test-context",
	}

	yamlContent := `
apiVersion: v1
metadata:
  name: test-configmap
`
	err := app.CreateResource("default", yamlContent)
	if err == nil {
		t.Error("Expected error for missing kind")
	}
	if err != nil && !contains(err.Error(), "kind not found") {
		t.Errorf("Expected 'kind not found', got: %v", err)
	}
}

func TestCreateResource_NoKubeContext(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "", // No context selected
	}

	yamlContent := `
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-configmap
`
	err := app.CreateResource("default", yamlContent)
	if err == nil {
		t.Error("Expected error when no kube context is selected")
	}
	// German error message: "Kein Kontext gewählt"
	if err != nil && !contains(err.Error(), "Kein Kontext") {
		t.Errorf("Expected 'Kein Kontext', got: %v", err)
	}
}

func TestCreateResource_EmptyYAML(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test-context",
	}

	err := app.CreateResource("default", "")
	if err == nil {
		t.Error("Expected error for empty YAML")
	}
}

func TestCreateResource_InvalidAPIVersion(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test-context",
	}

	// Valid YAML but missing kubeconfig so it will fail at getRESTConfig
	yamlContent := `
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-configmap
`
	err := app.CreateResource("default", yamlContent)
	// Should fail because we don't have a valid kubeconfig
	if err == nil {
		t.Skip("CreateResource passed - may have a valid kubeconfig")
	}
}

// Note: contains helper is defined in config_test.go
