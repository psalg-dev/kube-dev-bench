package docker

import (
	"testing"
)

func TestSwarmStackResources_FieldsExist(t *testing.T) {
	resources := &SwarmStackResources{
		Networks: []SwarmNetworkInfo{{Name: "net1", ID: "id1"}},
		Volumes:  []SwarmVolumeInfo{{Name: "vol1"}},
		Configs:  []SwarmConfigInfo{{Name: "cfg1", ID: "c1"}},
		Secrets:  []SwarmSecretInfo{{Name: "sec1", ID: "s1"}},
	}

	if len(resources.Networks) != 1 {
		t.Error("expected 1 network")
	}
	if len(resources.Volumes) != 1 {
		t.Error("expected 1 volume")
	}
	if len(resources.Configs) != 1 {
		t.Error("expected 1 config")
	}
	if len(resources.Secrets) != 1 {
		t.Error("expected 1 secret")
	}
}

func TestSwarmStackResources_EmptyByDefault(t *testing.T) {
	resources := &SwarmStackResources{}

	if len(resources.Networks) != 0 {
		t.Error("expected empty networks")
	}
	if len(resources.Volumes) != 0 {
		t.Error("expected empty volumes")
	}
	if len(resources.Configs) != 0 {
		t.Error("expected empty configs")
	}
	if len(resources.Secrets) != 0 {
		t.Error("expected empty secrets")
	}
}
