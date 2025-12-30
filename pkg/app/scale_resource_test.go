package app

import (
	"context"
	"strings"
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

// TestScaleResource_NegativeReplicas tests error on negative replicas
func TestScaleResource_NegativeReplicas(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	err := app.ScaleResource("Deployment", "default", "test", -1)
	if err == nil {
		t.Error("expected error for negative replicas, got nil")
	}
	if !strings.Contains(err.Error(), "non-negative") {
		t.Errorf("expected non-negative error, got: %v", err)
	}
}

// TestScaleResource_UnsupportedKind tests error on unsupported kind
func TestScaleResource_UnsupportedKind(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	kinds := []string{"Pod", "Service", "ConfigMap", "Secret", "Job", "CronJob", "Unknown"}
	for _, kind := range kinds {
		t.Run(kind, func(t *testing.T) {
			err := app.ScaleResource(kind, "default", "test", 2)
			if err == nil {
				t.Errorf("expected error for kind %s, got nil", kind)
			}
			if !strings.Contains(err.Error(), "not supported") {
				t.Errorf("expected 'not supported' error for kind %s, got: %v", kind, err)
			}
		})
	}
}

// TestScaleResource_DaemonSetNotScalable tests error for daemonset
func TestScaleResource_DaemonSetNotScalable(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	err := app.ScaleResource("DaemonSet", "default", "test", 2)
	if err == nil {
		t.Error("expected error for DaemonSet scaling, got nil")
	}
	if err.Error() != "daemonsets do not support replica scaling; they run once per matching node" {
		t.Errorf("unexpected error message: %v", err)
	}
}

// TestScaleResource_DaemonSetsPlural tests error for daemonsets (plural)
func TestScaleResource_DaemonSetsPlural(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	err := app.ScaleResource("daemonsets", "default", "test", 2)
	if err == nil {
		t.Error("expected error for daemonsets scaling, got nil")
	}
}

// TestScaleResource_DeploymentKindVariations tests different case variations
func TestScaleResource_DeploymentKindVariations(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	// These should all reach the scale code path (and fail because resource doesn't exist)
	variations := []string{"Deployment", "deployment", "DEPLOYMENT", "deployments", "Deployments"}
	for _, kind := range variations {
		t.Run(kind, func(t *testing.T) {
			err := app.ScaleResource(kind, "default", "nonexistent", 2)
			// Should fail but NOT with "not supported" error
			if err == nil {
				t.Error("expected error, got nil")
			}
			if strings.Contains(err.Error(), "not supported") {
				t.Errorf("kind %s should be supported, got: %v", kind, err)
			}
		})
	}
}

// TestScaleResource_StatefulSetKindVariations tests different case variations
func TestScaleResource_StatefulSetKindVariations(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	variations := []string{"StatefulSet", "statefulset", "statefulsets", "StatefulSets"}
	for _, kind := range variations {
		t.Run(kind, func(t *testing.T) {
			err := app.ScaleResource(kind, "default", "nonexistent", 2)
			if err == nil {
				t.Error("expected error, got nil")
			}
			if strings.Contains(err.Error(), "not supported") {
				t.Errorf("kind %s should be supported, got: %v", kind, err)
			}
		})
	}
}

// TestScaleResource_ReplicaSetKindVariations tests different case variations
func TestScaleResource_ReplicaSetKindVariations(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}

	variations := []string{"ReplicaSet", "replicaset", "replicasets", "ReplicaSets"}
	for _, kind := range variations {
		t.Run(kind, func(t *testing.T) {
			err := app.ScaleResource(kind, "default", "nonexistent", 2)
			if err == nil {
				t.Error("expected error, got nil")
			}
			if strings.Contains(err.Error(), "not supported") {
				t.Errorf("kind %s should be supported, got: %v", kind, err)
			}
		})
	}
}
