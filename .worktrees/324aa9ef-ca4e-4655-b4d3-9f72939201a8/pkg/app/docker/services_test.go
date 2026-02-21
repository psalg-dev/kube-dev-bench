package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
)

func TestServiceToInfo_ReplicatedModePortsAndImage(t *testing.T) {
	replicas := uint64(3)
	svc := swarm.Service{
		ID: "sid",
		Meta: swarm.Meta{
			CreatedAt: time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC),
			UpdatedAt: time.Date(2025, 1, 3, 0, 0, 0, 0, time.UTC),
		},
		Spec: swarm.ServiceSpec{
			Annotations:  swarm.Annotations{Name: "web", Labels: nil},
			TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "nginx:latest"}},
			Mode:         swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: &replicas}},
		},
		Endpoint: swarm.Endpoint{
			Ports: []swarm.PortConfig{{Protocol: swarm.PortConfigProtocolTCP, TargetPort: 80, PublishedPort: 8080, PublishMode: swarm.PortConfigPublishModeIngress}},
		},
	}

	out := serviceToInfo(svc, 2)
	if out.Name != "web" {
		t.Fatalf("expected name web, got %q", out.Name)
	}
	if out.Mode != "replicated" || out.Replicas != 3 {
		t.Fatalf("unexpected mode/replicas: %#v", out)
	}
	if out.Image != "nginx:latest" {
		t.Fatalf("expected image nginx:latest, got %q", out.Image)
	}
	if len(out.Ports) != 1 || out.Ports[0].PublishedPort != 8080 {
		t.Fatalf("unexpected ports: %#v", out.Ports)
	}
	if out.Labels == nil {
		t.Fatalf("expected labels map to be non-nil")
	}
}

func TestServiceToInfo_GlobalModeSetsReplicasToRunningTasks(t *testing.T) {
	svc := swarm.Service{
		ID:   "sid",
		Meta: swarm.Meta{CreatedAt: time.Now(), UpdatedAt: time.Now()},
		Spec: swarm.ServiceSpec{
			Annotations: swarm.Annotations{Name: "agent"},
			Mode:        swarm.ServiceMode{Global: &swarm.GlobalService{}},
		},
	}

	out := serviceToInfo(svc, 5)
	if out.Mode != "global" {
		t.Fatalf("expected global mode, got %q", out.Mode)
	}
	if out.Replicas != 5 {
		t.Fatalf("expected replicas=runningTasks=5, got %d", out.Replicas)
	}
}
