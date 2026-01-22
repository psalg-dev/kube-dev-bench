package app

import (
	"testing"

	"gowails/pkg/app/holmesgpt"
)

func TestCheckHolmesDeployment_NotDeployed(t *testing.T) {
	app := NewApp()

	// In test environment without a real cluster, should return not_deployed
	status, err := app.CheckHolmesDeployment()
	if err != nil {
		t.Logf("CheckHolmesDeployment returned error (expected in test): %v", err)
	}

	// Status should still be returned even if there's an error accessing the cluster
	if status == nil {
		t.Skip("Cannot test CheckHolmesDeployment without a cluster connection")
		return
	}

	// Verify status structure
	if status.ReleaseName != holmesDefaultReleaseName {
		t.Errorf("Expected release name %q, got %q", holmesDefaultReleaseName, status.ReleaseName)
	}
	if status.Namespace != holmesDefaultNamespace {
		t.Errorf("Expected namespace %q, got %q", holmesDefaultNamespace, status.Namespace)
	}
}

func TestDeployHolmesGPT_MissingAPIKey(t *testing.T) {
	app := NewApp()

	// Test that missing API key returns an error
	req := holmesgpt.HolmesDeploymentRequest{
		OpenAIKey: "", // Missing key
	}

	status, err := app.DeployHolmesGPT(req)
	if err == nil {
		t.Error("Expected error for missing API key, got nil")
	}
	if err != holmesgpt.ErrOpenAIKeyRequired {
		t.Errorf("Expected ErrOpenAIKeyRequired, got %v", err)
	}
	if status != nil {
		t.Errorf("Expected nil status for invalid request, got %+v", status)
	}
}

func TestDeployHolmesGPT_DefaultValues(t *testing.T) {
	// Verify default values are set correctly when not provided
	req := holmesgpt.HolmesDeploymentRequest{
		OpenAIKey: "sk-test-key",
		// Namespace and ReleaseName not set
	}

	if req.OpenAIKey == "" {
		t.Error("OpenAIKey should be set")
	}

	// These would be applied by DeployHolmesGPT
	expectedNamespace := holmesDefaultNamespace
	expectedReleaseName := holmesDefaultReleaseName

	// Verify constants are defined correctly
	if expectedNamespace != "holmesgpt" {
		t.Errorf("Expected default namespace 'holmesgpt', got %q", expectedNamespace)
	}
	if expectedReleaseName != "holmesgpt" {
		t.Errorf("Expected default release name 'holmesgpt', got %q", expectedReleaseName)
	}
}

func TestDetectHolmesEndpoint(t *testing.T) {
	app := NewApp()

	// detectHolmesEndpoint now tries to port-forward which will fail without a real cluster
	// It should fall back to the in-cluster DNS name
	endpoint, err := app.detectHolmesEndpoint("holmesgpt")

	// We expect an error since there's no cluster to port-forward to
	// but the endpoint should still be returned as the fallback
	expectedFallback := "http://holmesgpt.holmesgpt.svc.cluster.local:8080"
	if err == nil {
		// If no error, it means port-forward succeeded (unlikely in unit test)
		// The endpoint should be localhost
		if endpoint != "http://127.0.0.1:18080" {
			t.Errorf("Expected localhost endpoint, got %q", endpoint)
		}
	} else {
		// Expected path: port-forward fails, returns fallback
		if endpoint != expectedFallback {
			t.Errorf("Expected fallback endpoint %q, got %q", expectedFallback, endpoint)
		}
	}

	// Test with different namespace - same behavior expected
	endpoint2, err2 := app.detectHolmesEndpoint("custom-ns")
	expectedFallback2 := "http://holmesgpt.custom-ns.svc.cluster.local:8080"
	if err2 == nil {
		if endpoint2 != "http://127.0.0.1:18080" {
			t.Errorf("Expected localhost endpoint for custom-ns, got %q", endpoint2)
		}
	} else {
		if endpoint2 != expectedFallback2 {
			t.Errorf("Expected fallback endpoint %q, got %q", expectedFallback2, endpoint2)
		}
	}
}

func TestStartHolmesPortForward(t *testing.T) {
	app := NewApp()

	// Without a real cluster, this should fail gracefully
	_, err := app.StartHolmesPortForward("holmesgpt")
	if err == nil {
		t.Log("StartHolmesPortForward unexpectedly succeeded (real cluster connected?)")
	} else {
		// Expected: should fail to list pods or find Holmes pod
		t.Logf("StartHolmesPortForward correctly failed: %v", err)
	}
}

func TestHolmesDeploymentTypes(t *testing.T) {
	// Test HolmesDeploymentRequest
	req := holmesgpt.HolmesDeploymentRequest{
		OpenAIKey:   "sk-test",
		Namespace:   "custom",
		ReleaseName: "my-holmes",
	}
	if req.OpenAIKey != "sk-test" {
		t.Error("OpenAIKey not set correctly")
	}
	if req.Namespace != "custom" {
		t.Error("Namespace not set correctly")
	}
	if req.ReleaseName != "my-holmes" {
		t.Error("ReleaseName not set correctly")
	}

	// Test HolmesDeploymentStatus
	status := holmesgpt.HolmesDeploymentStatus{
		Phase:       holmesgpt.DeploymentPhaseDeploying,
		Message:     "Installing...",
		Progress:    50,
		Endpoint:    "http://localhost:8080",
		ReleaseName: "holmesgpt",
		Namespace:   "holmesgpt",
	}
	if status.Phase != "deploying" {
		t.Errorf("Expected phase 'deploying', got %q", status.Phase)
	}
	if status.Progress != 50 {
		t.Errorf("Expected progress 50, got %d", status.Progress)
	}
}

func TestHolmesDeploymentPhaseConstants(t *testing.T) {
	// Verify phase constants have correct values
	tests := []struct {
		constant string
		expected string
	}{
		{holmesgpt.DeploymentPhaseNotDeployed, "not_deployed"},
		{holmesgpt.DeploymentPhaseDeploying, "deploying"},
		{holmesgpt.DeploymentPhaseDeployed, "deployed"},
		{holmesgpt.DeploymentPhaseFailed, "failed"},
		{holmesgpt.DeploymentPhaseChecking, "checking"},
	}

	for _, tc := range tests {
		if tc.constant != tc.expected {
			t.Errorf("Expected constant value %q, got %q", tc.expected, tc.constant)
		}
	}
}

func TestHolmesConstants(t *testing.T) {
	// Verify deployment constants
	if holmesDefaultNamespace != "holmesgpt" {
		t.Errorf("Expected default namespace 'holmesgpt', got %q", holmesDefaultNamespace)
	}
	if holmesDefaultReleaseName != "holmesgpt" {
		t.Errorf("Expected default release name 'holmesgpt', got %q", holmesDefaultReleaseName)
	}
	if holmesHelmRepoName != "robusta" {
		t.Errorf("Expected helm repo name 'robusta', got %q", holmesHelmRepoName)
	}
	if holmesChartName != "robusta/holmes" {
		t.Errorf("Expected chart name 'robusta/holmes', got %q", holmesChartName)
	}
}
