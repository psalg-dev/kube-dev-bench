package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
)

func TestServiceReferencesConfig(t *testing.T) {
	// nil container spec
	if serviceReferencesConfig(swarm.Service{}, "id", "name") {
		t.Fatalf("expected false for empty service")
	}

	svc := swarm.Service{Spec: swarm.ServiceSpec{TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{}}}}
	if serviceReferencesConfig(svc, "id", "name") {
		t.Fatalf("expected false for no configs")
	}

	svc.Spec.TaskTemplate.ContainerSpec.Configs = []*swarm.ConfigReference{{ConfigID: "cfg1", ConfigName: "mycfg"}}
	if !serviceReferencesConfig(svc, "cfg1", "") {
		t.Fatalf("expected true by configID")
	}
	if !serviceReferencesConfig(svc, "other", "mycfg") {
		t.Fatalf("expected true by configName")
	}
	if serviceReferencesConfig(svc, "other", "other") {
		t.Fatalf("expected false for non-matching")
	}
}

func TestReplaceServiceConfigRefs(t *testing.T) {
	spec := &swarm.ServiceSpec{TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Configs: []*swarm.ConfigReference{{ConfigID: "old", ConfigName: "oldname"}, {ConfigID: "keep", ConfigName: "keepname"}}}}}

	changed := replaceServiceConfigRefs(spec, "old", "oldname", "new", "newname")
	if !changed {
		t.Fatalf("expected changed=true")
	}
	got := spec.TaskTemplate.ContainerSpec.Configs
	if got[0].ConfigID != "new" || got[0].ConfigName != "newname" {
		t.Fatalf("expected first ref updated, got %+v", *got[0])
	}
	if got[1].ConfigID != "keep" || got[1].ConfigName != "keepname" {
		t.Fatalf("expected second ref unchanged, got %+v", *got[1])
	}

	// no-op should return false
	changed = replaceServiceConfigRefs(spec, "missing", "missing", "new2", "new2")
	if changed {
		t.Fatalf("expected changed=false")
	}
}

func TestConfigToInfo_LabelsDefault(t *testing.T) {
	cfg := swarm.Config{
		ID:   "id",
		Spec: swarm.ConfigSpec{Annotations: swarm.Annotations{Name: "n"}, Data: []byte("x")},
		Meta: swarm.Meta{
			CreatedAt: time.Date(2026, 1, 11, 0, 0, 0, 0, time.UTC),
			UpdatedAt: time.Date(2026, 1, 11, 0, 0, 0, 0, time.UTC),
		},
	}
	info := configToInfo(cfg)
	if info.Labels == nil {
		t.Fatalf("expected labels map not nil")
	}
	if info.DataSize != 1 {
		t.Fatalf("expected DataSize=1 got %d", info.DataSize)
	}
}
