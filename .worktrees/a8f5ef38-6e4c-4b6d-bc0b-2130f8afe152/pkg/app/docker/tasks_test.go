package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/swarm"
)

func TestTaskToInfo_PopulatesContainerIDAndError(t *testing.T) {
	task := swarm.Task{
		ID:           "tid",
		ServiceID:    "sid",
		NodeID:       "nid",
		Slot:         1,
		DesiredState: swarm.TaskStateRunning,
		Meta: swarm.Meta{
			CreatedAt: time.Date(2025, 1, 2, 0, 0, 0, 0, time.UTC),
			UpdatedAt: time.Date(2025, 1, 2, 1, 0, 0, 0, time.UTC),
		},
		Status: swarm.TaskStatus{
			State:           swarm.TaskStateFailed,
			Err:             "boom",
			ContainerStatus: &swarm.ContainerStatus{ContainerID: "cid"},
		},
		Spec: swarm.TaskSpec{
			ContainerSpec: &swarm.ContainerSpec{
				Healthcheck: &container.HealthConfig{
					Test:        []string{"CMD-SHELL", "echo ok"},
					Interval:    5 * time.Second,
					Timeout:     2 * time.Second,
					Retries:     3,
					StartPeriod: 1 * time.Second,
				},
			},
		},
	}

	services := map[string]string{"sid": "svc"}
	nodes := map[string]string{"nid": "node"}
	out := taskToInfo(task, services, nodes)

	if out.ContainerID != "cid" {
		t.Fatalf("expected container id cid, got %q", out.ContainerID)
	}
	if out.Error != "boom" {
		t.Fatalf("expected error boom, got %q", out.Error)
	}
	if out.HealthStatus != "none" {
		t.Fatalf("expected default health status none, got %q", out.HealthStatus)
	}
	if out.HealthCheck == nil || len(out.HealthCheck.Test) == 0 {
		t.Fatalf("expected healthcheck info to be populated, got %#v", out.HealthCheck)
	}
	if out.ServiceName != "svc" || out.NodeName != "node" {
		t.Fatalf("unexpected names: %#v", out)
	}
}
