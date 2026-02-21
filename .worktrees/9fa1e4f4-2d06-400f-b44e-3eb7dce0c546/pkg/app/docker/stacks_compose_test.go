package docker

import (
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
	"gopkg.in/yaml.v3"
)

// ---- buildServicePorts ----

func TestBuildServicePorts_Nil(t *testing.T) {
	result := buildServicePorts(nil)
	if result != nil {
		t.Errorf("expected nil, got %v", result)
	}
}

func TestBuildServicePorts_Empty(t *testing.T) {
	result := buildServicePorts([]swarm.PortConfig{})
	if len(result) != 0 {
		t.Errorf("expected empty slice, got %v", result)
	}
}

func TestBuildServicePorts_ValidTCP(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 8080, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
	}
	result := buildServicePorts(ports)
	if len(result) != 1 {
		t.Fatalf("expected 1 port, got %d", len(result))
	}
	if result[0] != "8080:80/tcp" {
		t.Errorf("expected '8080:80/tcp', got %q", result[0])
	}
}

func TestBuildServicePorts_ValidUDP(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 53, TargetPort: 53, Protocol: swarm.PortConfigProtocolUDP},
	}
	result := buildServicePorts(ports)
	if len(result) != 1 {
		t.Fatalf("expected 1 port, got %d", len(result))
	}
	if result[0] != "53:53/udp" {
		t.Errorf("expected '53:53/udp', got %q", result[0])
	}
}

func TestBuildServicePorts_DefaultProtocol(t *testing.T) {
	// empty protocol should default to "tcp"
	ports := []swarm.PortConfig{
		{PublishedPort: 9000, TargetPort: 9000, Protocol: ""},
	}
	result := buildServicePorts(ports)
	if len(result) != 1 {
		t.Fatalf("expected 1 port, got %d", len(result))
	}
	if !strings.HasSuffix(result[0], "/tcp") {
		t.Errorf("expected port to end with /tcp, got %q", result[0])
	}
}

func TestBuildServicePorts_SkipsZeroPublished(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 0, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
	}
	result := buildServicePorts(ports)
	if len(result) != 0 {
		t.Errorf("expected 0 ports (zero published), got %v", result)
	}
}

func TestBuildServicePorts_SkipsZeroTarget(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 8080, TargetPort: 0, Protocol: swarm.PortConfigProtocolTCP},
	}
	result := buildServicePorts(ports)
	if len(result) != 0 {
		t.Errorf("expected 0 ports (zero target), got %v", result)
	}
}

func TestBuildServicePorts_Mixed(t *testing.T) {
	ports := []swarm.PortConfig{
		{PublishedPort: 8080, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
		{PublishedPort: 0, TargetPort: 53, Protocol: swarm.PortConfigProtocolUDP},  // skipped
		{PublishedPort: 443, TargetPort: 443, Protocol: swarm.PortConfigProtocolTCP},
	}
	result := buildServicePorts(ports)
	if len(result) != 2 {
		t.Fatalf("expected 2 ports, got %d: %v", len(result), result)
	}
}

// ---- buildComposeUpdateConfig ----

func TestBuildComposeUpdateConfig_Nil(t *testing.T) {
	result := buildComposeUpdateConfig(nil)
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestBuildComposeUpdateConfig_AllZero(t *testing.T) {
	uc := &swarm.UpdateConfig{}
	result := buildComposeUpdateConfig(uc)
	if result != nil {
		t.Errorf("expected nil for empty update config, got %v", result)
	}
}

func TestBuildComposeUpdateConfig_WithParallelism(t *testing.T) {
	uc := &swarm.UpdateConfig{Parallelism: 2}
	result := buildComposeUpdateConfig(uc)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Parallelism == nil || *result.Parallelism != 2 {
		t.Errorf("expected parallelism=2, got %v", result.Parallelism)
	}
}

func TestBuildComposeUpdateConfig_WithDelay(t *testing.T) {
	uc := &swarm.UpdateConfig{Delay: 10 * time.Second}
	result := buildComposeUpdateConfig(uc)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Delay == "" {
		t.Error("expected non-empty delay")
	}
}

func TestBuildComposeUpdateConfig_WithFailureAction(t *testing.T) {
	uc := &swarm.UpdateConfig{FailureAction: "pause"}
	result := buildComposeUpdateConfig(uc)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.FailureAction != "pause" {
		t.Errorf("expected failure_action=pause, got %q", result.FailureAction)
	}
}

func TestBuildComposeUpdateConfig_WithOrder(t *testing.T) {
	uc := &swarm.UpdateConfig{Order: "start-first"}
	result := buildComposeUpdateConfig(uc)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Order != "start-first" {
		t.Errorf("expected order=start-first, got %q", result.Order)
	}
}

func TestBuildComposeUpdateConfig_FullConfig(t *testing.T) {
	uc := &swarm.UpdateConfig{
		Parallelism:   2,
		Delay:         5 * time.Second,
		FailureAction: "rollback",
		Order:         "stop-first",
	}
	result := buildComposeUpdateConfig(uc)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Parallelism == nil || *result.Parallelism != 2 {
		t.Errorf("unexpected parallelism: %v", result.Parallelism)
	}
	if result.FailureAction != "rollback" {
		t.Errorf("unexpected failure_action: %q", result.FailureAction)
	}
	if result.Order != "stop-first" {
		t.Errorf("unexpected order: %q", result.Order)
	}
}

// ---- buildComposeRestartPolicy ----

func TestBuildComposeRestartPolicy_Nil(t *testing.T) {
	result := buildComposeRestartPolicy(nil)
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestBuildComposeRestartPolicy_AllEmpty(t *testing.T) {
	rp := &swarm.RestartPolicy{}
	result := buildComposeRestartPolicy(rp)
	if result != nil {
		t.Errorf("expected nil for empty restart policy, got %v", result)
	}
}

func TestBuildComposeRestartPolicy_WithCondition(t *testing.T) {
	rp := &swarm.RestartPolicy{Condition: swarm.RestartPolicyConditionOnFailure}
	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Condition != string(swarm.RestartPolicyConditionOnFailure) {
		t.Errorf("expected condition on-failure, got %q", result.Condition)
	}
}

func TestBuildComposeRestartPolicy_WithDelay(t *testing.T) {
	d := 5 * time.Second
	rp := &swarm.RestartPolicy{Delay: &d}
	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Delay == "" {
		t.Error("expected non-empty delay")
	}
}

func TestBuildComposeRestartPolicy_WithZeroDelay(t *testing.T) {
	d := time.Duration(0)
	rp := &swarm.RestartPolicy{Condition: swarm.RestartPolicyConditionAny, Delay: &d}
	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil result (has condition)")
	}
	if result.Delay != "" {
		t.Errorf("expected empty delay for zero duration, got %q", result.Delay)
	}
}

func TestBuildComposeRestartPolicy_WithMaxAttempts(t *testing.T) {
	ma := uint64(3)
	rp := &swarm.RestartPolicy{MaxAttempts: &ma}
	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.MaxAttempts == nil || *result.MaxAttempts != 3 {
		t.Errorf("expected max_attempts=3, got %v", result.MaxAttempts)
	}
}

func TestBuildComposeRestartPolicy_WithWindow(t *testing.T) {
	w := 120 * time.Second
	rp := &swarm.RestartPolicy{Window: &w}
	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Window == "" {
		t.Error("expected non-empty window")
	}
}

func TestBuildComposeRestartPolicy_ZeroWindow(t *testing.T) {
	w := time.Duration(0)
	ma := uint64(2)
	rp := &swarm.RestartPolicy{MaxAttempts: &ma, Window: &w}
	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil result (has max_attempts)")
	}
	if result.Window != "" {
		t.Errorf("expected empty window for zero duration, got %q", result.Window)
	}
}

// ---- buildComposeDeploy ----

func TestBuildComposeDeploy_NoMode_NoUpdate_NoRestart(t *testing.T) {
	svc := &swarm.Service{}
	result := buildComposeDeploy(svc)
	if result != nil {
		t.Errorf("expected nil for empty service, got %+v", result)
	}
}

func TestBuildComposeDeploy_ReplicatedMode(t *testing.T) {
	replicas := uint64(3)
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: &replicas},
			},
		},
	}
	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil deploy")
	}
	if result.Mode != "replicated" {
		t.Errorf("expected mode=replicated, got %q", result.Mode)
	}
	if result.Replicas == nil || *result.Replicas != 3 {
		t.Errorf("expected replicas=3, got %v", result.Replicas)
	}
}

func TestBuildComposeDeploy_ReplicatedMode_NilReplicas(t *testing.T) {
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: nil},
			},
		},
	}
	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil deploy")
	}
	if result.Mode != "replicated" {
		t.Errorf("expected mode=replicated, got %q", result.Mode)
	}
	if result.Replicas != nil {
		t.Errorf("expected nil replicas, got %v", result.Replicas)
	}
}

func TestBuildComposeDeploy_GlobalMode(t *testing.T) {
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Global: &swarm.GlobalService{},
			},
		},
	}
	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil deploy")
	}
	if result.Mode != "global" {
		t.Errorf("expected mode=global, got %q", result.Mode)
	}
}

func TestBuildComposeDeploy_WithUpdateConfig(t *testing.T) {
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			UpdateConfig: &swarm.UpdateConfig{Parallelism: 1},
		},
	}
	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil deploy (has update config)")
	}
	if result.Update == nil {
		t.Error("expected non-nil update config")
	}
}

func TestBuildComposeDeploy_WithRestartPolicy(t *testing.T) {
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				RestartPolicy: &swarm.RestartPolicy{
					Condition: swarm.RestartPolicyConditionOnFailure,
				},
			},
		},
	}
	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil deploy (has restart policy)")
	}
	if result.Restart == nil {
		t.Error("expected non-nil restart policy")
	}
}

// ---- buildComposeService ----

func TestBuildComposeService_Basic(t *testing.T) {
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Annotations: swarm.Annotations{
				Labels: map[string]string{"app": "test"},
			},
			TaskTemplate: swarm.TaskSpec{
				ContainerSpec: &swarm.ContainerSpec{
					Image: "nginx:latest",
				},
			},
		},
		Endpoint: swarm.Endpoint{
			Spec: swarm.EndpointSpec{
				Ports: []swarm.PortConfig{
					{PublishedPort: 80, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
				},
			},
		},
	}
	cs := buildComposeService(svc)
	if cs.Image != "nginx:latest" {
		t.Errorf("expected image=nginx:latest, got %q", cs.Image)
	}
	if len(cs.Ports) != 1 {
		t.Errorf("expected 1 port, got %d", len(cs.Ports))
	}
}

// ---- GetSwarmStackComposeYAML (empty stack scenario via internal types) ----

func TestGetSwarmStackComposeYAML_Empty(t *testing.T) {
	// Simulate the behavior: no services match the stack name,
	// so the compose file is built with an empty services map.
	cf := composeFile{
		Version:  "3.8",
		Services: map[string]composeService{},
	}
	b, err := yaml.Marshal(cf)
	if err != nil {
		t.Fatalf("unexpected marshal error: %v", err)
	}
	out := strings.TrimSpace(string(b))
	// Must not contain any service entries
	if strings.Contains(out, "image:") {
		t.Error("expected no service image entries in empty stack output")
	}
	// Version header must be present
	if !strings.Contains(out, "3.8") {
		t.Errorf("expected version 3.8 in YAML, got: %s", out)
	}
}

func TestGetSwarmStackComposeYAML_ServiceBuilding(t *testing.T) {
	// Build a compose file the same way GetSwarmStackComposeYAML does,
	// exercising the marshaling path for a matched service.
	replicas := uint64(2)
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Annotations: swarm.Annotations{
				Name:   "mystack_web",
				Labels: map[string]string{"com.docker.stack.namespace": "mystack"},
			},
			TaskTemplate: swarm.TaskSpec{
				ContainerSpec: &swarm.ContainerSpec{Image: "nginx:1.25"},
				RestartPolicy: &swarm.RestartPolicy{Condition: swarm.RestartPolicyConditionOnFailure},
			},
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: &replicas},
			},
		},
		Endpoint: swarm.Endpoint{
			Spec: swarm.EndpointSpec{
				Ports: []swarm.PortConfig{
					{PublishedPort: 8080, TargetPort: 80, Protocol: swarm.PortConfigProtocolTCP},
				},
			},
		},
	}

	cf := composeFile{
		Version:  "3.8",
		Services: map[string]composeService{},
	}
	cf.Services[svc.Spec.Name] = buildComposeService(svc)

	b, err := yaml.Marshal(cf)
	if err != nil {
		t.Fatalf("unexpected marshal error: %v", err)
	}
	out := strings.TrimSpace(string(b))
	if !strings.Contains(out, "nginx:1.25") {
		t.Errorf("expected image nginx:1.25 in YAML output, got:\n%s", out)
	}
	if !strings.Contains(out, "8080:80/tcp") {
		t.Errorf("expected port 8080:80/tcp in YAML output, got:\n%s", out)
	}
	if !strings.Contains(out, "replicated") {
		t.Errorf("expected mode=replicated in YAML output, got:\n%s", out)
	}
}
