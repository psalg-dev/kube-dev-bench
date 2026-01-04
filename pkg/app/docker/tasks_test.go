package docker

import (
	"testing"
	"time"

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
	if out.ServiceName != "svc" || out.NodeName != "node" {
		t.Fatalf("unexpected names: %#v", out)
	}
}
