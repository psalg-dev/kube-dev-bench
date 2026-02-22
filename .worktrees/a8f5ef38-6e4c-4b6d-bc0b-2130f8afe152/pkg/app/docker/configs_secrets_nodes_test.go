package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
)

func TestConfigToInfo_NilLabels_DefaultsToEmptyMapAndComputesSize(t *testing.T) {
	cfg := swarm.Config{
		ID: "cid",
		Meta: swarm.Meta{
			CreatedAt: time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC),
			UpdatedAt: time.Date(2025, 1, 2, 1, 0, 0, 0, time.UTC),
		},
		Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "c1", Labels: nil}, Data: []byte("abc")},
	}
	out := configToInfo(cfg)
	if out.Name != "c1" {
		t.Fatalf("expected name c1, got %q", out.Name)
	}
	if out.DataSize != 3 {
		t.Fatalf("expected datasize 3, got %d", out.DataSize)
	}
	if out.Labels == nil {
		t.Fatalf("expected non-nil labels")
	}
}

func TestSecretToInfo_NilLabels_DefaultsToEmptyMap(t *testing.T) {
	secret := swarm.Secret{
		ID:   "sid",
		Meta: swarm.Meta{CreatedAt: time.Now(), UpdatedAt: time.Now()},
		Spec: swarm.SecretSpec{Annotations: swarm.Annotations{Name: "s1", Labels: nil}},
	}
	out := secretToInfo(secret)
	if out.Name != "s1" {
		t.Fatalf("expected name s1, got %q", out.Name)
	}
	if out.Labels == nil {
		t.Fatalf("expected non-nil labels")
	}
}

func TestNodeToInfo_LeaderAndLabelsDefault(t *testing.T) {
	node := swarm.Node{
		ID: "nid",
		Description: swarm.NodeDescription{
			Hostname: "h1",
			Engine:   swarm.EngineDescription{EngineVersion: "25.0"},
		},
		Spec:          swarm.NodeSpec{Annotations: swarm.Annotations{Labels: nil}, Role: swarm.NodeRoleManager, Availability: swarm.NodeAvailabilityActive},
		Status:        swarm.NodeStatus{State: swarm.NodeStateReady, Addr: "10.0.0.1"},
		ManagerStatus: &swarm.ManagerStatus{Leader: true},
	}

	out := nodeToInfo(node)
	if out.Leader != true {
		t.Fatalf("expected leader true")
	}
	if out.Labels == nil {
		t.Fatalf("expected non-nil labels")
	}
	if out.Role != "manager" {
		t.Fatalf("expected role manager, got %q", out.Role)
	}
}
