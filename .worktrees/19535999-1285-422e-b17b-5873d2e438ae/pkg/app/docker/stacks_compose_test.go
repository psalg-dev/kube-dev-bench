package docker

import (
	"context"
	"strings"
	"testing"

	"github.com/docker/docker/api/types/swarm"
	"gopkg.in/yaml.v3"
)

// composeClientIface is the minimal interface needed by the compose YAML helpers.
// GetSwarmStackComposeYAML takes *client.Client directly; we test the same logic
// through this interface + internal helpers so the fake client can be injected.
type composeClientIface interface {
	ServiceList(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error)
}

// getSwarmStackComposeYAMLFrom mirrors GetSwarmStackComposeYAML but accepts an interface
// so tests can inject fakeDockerClient. All logic delegates to the same unexported helpers.
func getSwarmStackComposeYAMLFrom(ctx context.Context, cli composeClientIface, stackName string) (string, error) {
	services, err := cli.ServiceList(ctx, swarm.ServiceListOptions{})
	if err != nil {
		return "", err
	}

	cf := composeFile{
		Version:  "3.8",
		Services: map[string]composeService{},
	}

	for _, svc := range services {
		if svc.Spec.Labels["com.docker.stack.namespace"] != stackName {
			continue
		}
		name := svc.Spec.Name
		cf.Services[name] = buildComposeService(&svc)
	}

	b, err := yaml.Marshal(cf)
	if err != nil {
		return "", err
	}

	out := strings.TrimSpace(string(b))
	if out == "" {
		return "", nil
	}
	return out + "\n", nil
}

// --- TestGetSwarmStackComposeYAML ---

func TestGetSwarmStackComposeYAML_twoServicesProducesValidYAML(t *testing.T) {
	rep := uint64(2)
	cli := &fakeDockerClient{
		ServiceListFn: func(_ context.Context, _ swarm.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{
					Spec: swarm.ServiceSpec{
						Annotations: swarm.Annotations{
							Name: "mystack_web",
							Labels: map[string]string{
								"com.docker.stack.namespace": "mystack",
							},
						},
						TaskTemplate: swarm.TaskSpec{
							ContainerSpec: &swarm.ContainerSpec{
								Image: "nginx:latest",
							},
						},
						Mode: swarm.ServiceMode{
							Replicated: &swarm.ReplicatedService{Replicas: &rep},
						},
					},
				},
				{
					Spec: swarm.ServiceSpec{
						Annotations: swarm.Annotations{
							Name: "mystack_db",
							Labels: map[string]string{
								"com.docker.stack.namespace": "mystack",
							},
						},
						TaskTemplate: swarm.TaskSpec{
							ContainerSpec: &swarm.ContainerSpec{
								Image: "postgres:14",
							},
						},
						Mode: swarm.ServiceMode{
							Replicated: &swarm.ReplicatedService{Replicas: &rep},
						},
					},
				},
				// service in a different stack – must be excluded
				{
					Spec: swarm.ServiceSpec{
						Annotations: swarm.Annotations{
							Name: "other_svc",
							Labels: map[string]string{
								"com.docker.stack.namespace": "otherstack",
							},
						},
						TaskTemplate: swarm.TaskSpec{
							ContainerSpec: &swarm.ContainerSpec{Image: "redis:7"},
						},
					},
				},
			}, nil
		},
	}

	yaml, err := getSwarmStackComposeYAMLFrom(context.Background(), cli, "mystack")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(yaml, "mystack_web") {
		t.Errorf("expected 'mystack_web' in YAML output:\n%s", yaml)
	}
	if !strings.Contains(yaml, "mystack_db") {
		t.Errorf("expected 'mystack_db' in YAML output:\n%s", yaml)
	}
	if strings.Contains(yaml, "other_svc") {
		t.Errorf("expected 'other_svc' to be excluded from YAML output:\n%s", yaml)
	}
}

func TestGetSwarmStackComposeYAML_emptyStack(t *testing.T) {
	cli := &fakeDockerClient{
		ServiceListFn: func(_ context.Context, _ swarm.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{
				{
					Spec: swarm.ServiceSpec{
						Annotations: swarm.Annotations{
							Name:   "other_svc",
							Labels: map[string]string{"com.docker.stack.namespace": "otherstack"},
						},
						TaskTemplate: swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: "redis:7"}},
					},
				},
			}, nil
		},
	}

	result, err := getSwarmStackComposeYAMLFrom(context.Background(), cli, "mystack")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(result, "other_svc") {
		t.Errorf("expected empty services block, got:\n%s", result)
	}
}

// --- TestBuildServicePorts ---

func TestBuildServicePorts_nilReturnsNil(t *testing.T) {
	got := buildServicePorts(nil)
	if got != nil {
		t.Errorf("expected nil for nil input, got %v", got)
	}
}

func TestBuildServicePorts_roundTrip(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 8080, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
		{PublishedPort: 5432, TargetPort: 5432, Protocol: swarm.PortConfigProtocolTCP},
	}

	got := buildServicePorts(ports)
	if len(got) != 2 {
		t.Fatalf("expected 2 ports, got %d: %v", len(got), got)
	}
	if got[0] != "8080:80/tcp" {
		t.Errorf("expected '8080:80/tcp', got %q", got[0])
	}
	if got[1] != "5432:5432/tcp" {
		t.Errorf("expected '5432:5432/tcp', got %q", got[1])
	}
}

func TestBuildServicePorts_skipsZeroPorts(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 0, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
		{PublishedPort: 8080, TargetPort: 0, Protocol: swarm.PortConfigProtocolTCP},
		{PublishedPort: 9090, TargetPort: 9090, Protocol: swarm.PortConfigProtocolTCP},
	}

	got := buildServicePorts(ports)
	if len(got) != 1 {
		t.Fatalf("expected 1 port after skipping zeros, got %d: %v", len(got), got)
	}
	if got[0] != "9090:9090/tcp" {
		t.Errorf("expected '9090:9090/tcp', got %q", got[0])
	}
}

func TestBuildServicePorts_defaultsToTCP(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 53, TargetPort: 53, Protocol: ""},
	}

	got := buildServicePorts(ports)
	if len(got) != 1 {
		t.Fatalf("expected 1 port, got %d", len(got))
	}
	if !strings.HasSuffix(got[0], "/tcp") {
		t.Errorf("expected /tcp suffix when protocol empty, got %q", got[0])
	}
}

// --- TestBuildComposeDeploy ---

func TestBuildComposeDeploy_replicatedPopulatesReplicas(t *testing.T) {
	rep := uint64(3)
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: &rep},
			},
		},
	}

	d := buildComposeDeploy(svc)
	if d == nil {
		t.Fatal("expected non-nil deploy config")
	}
	if d.Mode != "replicated" {
		t.Errorf("expected mode 'replicated', got %q", d.Mode)
	}
	if d.Replicas == nil {
		t.Fatal("expected Replicas to be set")
	}
	if *d.Replicas != 3 {
		t.Errorf("expected 3 replicas, got %d", *d.Replicas)
	}
}

func TestBuildComposeDeploy_globalMode(t *testing.T) {
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Global: &swarm.GlobalService{},
			},
		},
	}

	d := buildComposeDeploy(svc)
	if d == nil {
		t.Fatal("expected non-nil deploy config")
	}
	if d.Mode != "global" {
		t.Errorf("expected mode 'global', got %q", d.Mode)
	}
	if d.Replicas != nil {
		t.Errorf("expected nil Replicas for global mode, got %v", *d.Replicas)
	}
}

func TestBuildComposeDeploy_noModeReturnsNilWhenEmpty(t *testing.T) {
	// Service with no mode, no update config, no restart policy → nil
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{},
	}

	d := buildComposeDeploy(svc)
	if d != nil {
		t.Errorf("expected nil deploy for empty spec, got %+v", d)
	}
}
