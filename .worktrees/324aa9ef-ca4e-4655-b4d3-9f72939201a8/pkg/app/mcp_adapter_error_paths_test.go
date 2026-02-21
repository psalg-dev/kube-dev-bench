package app

import (
	"strings"
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

func TestMCPAdapter_GetPodLogsPrevious_ErrorNoClient(t *testing.T) {
	adapter := &MCPServerAdapter{app: &App{}}
	if _, err := adapter.GetPodLogsPrevious("default", "pod1", "c1", 100); err == nil {
		t.Fatal("expected error when no client is configured")
	}
}

func TestMCPAdapter_TopPods_ErrorNoClient(t *testing.T) {
	adapter := &MCPServerAdapter{app: &App{}}
	if _, err := adapter.TopPods("default"); err == nil {
		t.Fatal("expected error when no client is configured")
	}
}

func TestMCPAdapter_TopNodes_ErrorNoClient(t *testing.T) {
	adapter := &MCPServerAdapter{app: &App{}}
	if _, err := adapter.TopNodes(); err == nil {
		t.Fatal("expected error when no client is configured")
	}
}

func TestMCPAdapter_GetRolloutStatus_InvalidKindPropagation(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	adapter := &MCPServerAdapter{app: app}
	_, err := adapter.GetRolloutStatus("Widget", "default", "name")
	if err == nil || !strings.Contains(err.Error(), "unsupported kind") {
		t.Fatalf("expected unsupported kind error, got %v", err)
	}
}

func TestMCPAdapter_GetRolloutHistory_InvalidKindPropagation(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	adapter := &MCPServerAdapter{app: app}
	_, err := adapter.GetRolloutHistory("Service", "default", "svc")
	if err == nil || !strings.Contains(err.Error(), "unsupported kind") {
		t.Fatalf("expected unsupported kind error, got %v", err)
	}
}
