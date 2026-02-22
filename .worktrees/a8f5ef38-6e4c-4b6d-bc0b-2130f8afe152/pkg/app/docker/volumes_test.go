package docker

import (
	"testing"

	"github.com/docker/docker/api/types/volume"
)

func TestVolumeToInfo_NilLabels_DefaultsToEmptyMap(t *testing.T) {
	in := &volume.Volume{
		Name:      "v1",
		Driver:    "local",
		Scope:     "local",
		Labels:    nil,
		CreatedAt: "2025-01-02T03:04:05Z",
	}

	out := volumeToInfo(in)
	if out.Name != "v1" {
		t.Fatalf("expected name v1, got %q", out.Name)
	}
	if out.Labels == nil {
		t.Fatalf("expected labels map to be non-nil")
	}
}

func TestBuildVolumeCreateOptions_PopulatesFields(t *testing.T) {
	labels := map[string]string{"a": "b"}
	dopts := map[string]string{"o": "x"}
	opts := buildVolumeCreateOptions("name", "local", labels, dopts)
	if opts.Name != "name" || opts.Driver != "local" {
		t.Fatalf("unexpected opts: %#v", opts)
	}
	if opts.Labels["a"] != "b" || opts.DriverOpts["o"] != "x" {
		t.Fatalf("unexpected labels/driver opts: %#v", opts)
	}
}
