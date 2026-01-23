package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gowails/pkg/app/holmesgpt"

	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

func TestAnalyzeSwarmServiceAndTask(t *testing.T) {
	serviceID := "svc123"
	taskID := "task123"
	containerID := "cont123"

	service := swarm.Service{
		ID: serviceID,
		Spec: swarm.ServiceSpec{
			Annotations:  swarm.Annotations{Name: "demo-service"},
			Mode:         swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: uint64Ptr(2)}},
			TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "nginx:alpine"}},
		},
	}

	task := swarm.Task{
		ID:        taskID,
		ServiceID: serviceID,
		NodeID:    "node123",
		Status: swarm.TaskStatus{
			State: swarm.TaskStateFailed,
			Err:   "boom",
			ContainerStatus: &swarm.ContainerStatus{
				ContainerID: containerID,
				ExitCode:    1,
			},
		},
	}

	dockerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasPrefix(path, "/v1.41/services/") && strings.HasSuffix(path, "/logs"):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("service log line"))
			return
		case strings.HasPrefix(path, "/v1.41/containers/") && strings.HasSuffix(path, "/logs"):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("container log line"))
			return
		case strings.HasPrefix(path, "/v1.41/services/"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(service)
			return
		case strings.HasPrefix(path, "/v1.41/tasks/"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(task)
			return
		case path == "/v1.41/tasks":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]swarm.Task{task})
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			return
		}
	}))
	defer dockerServer.Close()

	cli, err := client.NewClientWithOpts(
		client.WithHost(dockerServer.URL),
		client.WithVersion("1.41"),
		client.WithHTTPClient(dockerServer.Client()),
	)
	if err != nil {
		t.Fatalf("failed to create docker client: %v", err)
	}

	dockerClientMu.Lock()
	prevDockerClient := dockerClient
	dockerClient = cli
	dockerClientMu.Unlock()
	defer func() {
		dockerClientMu.Lock()
		if dockerClient != nil {
			_ = dockerClient.Close()
		}
		dockerClient = prevDockerClient
		dockerClientMu.Unlock()
	}()

	holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			_ = json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{
				Response: "swarm analysis",
				QueryID:  "swarm-q1",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer holmesServer.Close()

	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: holmesServer.URL,
	}
	defer func() { holmesConfig = holmesgpt.DefaultConfig() }()

	app := &App{ctx: context.Background()}
	app.initHolmes()

	respSvc, err := app.AnalyzeSwarmService(serviceID)
	if err != nil {
		t.Fatalf("AnalyzeSwarmService failed: %v", err)
	}
	if respSvc == nil || respSvc.Response == "" {
		t.Fatalf("expected swarm service response")
	}

	respTask, err := app.AnalyzeSwarmTask(taskID)
	if err != nil {
		t.Fatalf("AnalyzeSwarmTask failed: %v", err)
	}
	if respTask == nil || respTask.Response == "" {
		t.Fatalf("expected swarm task response")
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func uint64Ptr(v uint64) *uint64 { return &v }
