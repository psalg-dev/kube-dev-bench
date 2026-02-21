package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/network"
)

func TestNetworkResourceToInfo_NilLabels_DefaultsToEmptyMap(t *testing.T) {
	created := time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)
	in := network.Inspect{
		ID:         "nid",
		Name:       "n1",
		Driver:     "overlay",
		Scope:      "swarm",
		Attachable: true,
		Internal:   false,
		Labels:     nil,
		Created:    created,
	}

	out := networkResourceToInfo(in)
	if out.ID != "nid" || out.Name != "n1" {
		t.Fatalf("unexpected basic fields: %#v", out)
	}
	if out.Labels == nil {
		t.Fatalf("expected labels map to be non-nil")
	}
	if out.CreatedAt == "" {
		t.Fatalf("expected CreatedAt to be set")
	}
}

func TestBuildNetworkCreateOptions_OverlayDefaultsScopeToSwarm(t *testing.T) {
	opts := CreateNetworkOptions{}
	create := buildNetworkCreateOptions("overlay", opts)
	if create.Scope != "swarm" {
		t.Fatalf("expected scope swarm, got %q", create.Scope)
	}
}

func TestBuildNetworkCreateOptions_IPAMConfigIncluded(t *testing.T) {
	opts := CreateNetworkOptions{Subnet: "10.0.0.0/24", Gateway: "10.0.0.1"}
	create := buildNetworkCreateOptions("overlay", opts)
	if create.IPAM == nil || len(create.IPAM.Config) != 1 {
		t.Fatalf("expected 1 IPAM config, got %#v", create.IPAM)
	}
	if create.IPAM.Config[0].Subnet != "10.0.0.0/24" {
		t.Fatalf("unexpected subnet: %#v", create.IPAM.Config[0])
	}
	if create.IPAM.Config[0].Gateway != "10.0.0.1" {
		t.Fatalf("unexpected gateway: %#v", create.IPAM.Config[0])
	}
}
