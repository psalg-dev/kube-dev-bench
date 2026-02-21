package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
)

// ---------------------------------------------------------------------------
// buildServicePorts tests
// ---------------------------------------------------------------------------

func TestBuildServicePorts_BasicPorts(t *testing.T) {
	t.Parallel()

	ports := []swarm.PortConfig{
		{Protocol: swarm.PortConfigProtocolTCP, PublishedPort: 8080, TargetPort: 80},
		{Protocol: swarm.PortConfigProtocolUDP, PublishedPort: 5353, TargetPort: 53},
	}

	result := buildServicePorts(ports)
	if len(result) != 2 {
		t.Fatalf("expected 2 port strings, got %d: %v", len(result), result)
	}
	if result[0] != "8080:80/tcp" {
		t.Errorf("port[0]: got %q, want 8080:80/tcp", result[0])
	}
	if result[1] != "5353:53/udp" {
		t.Errorf("port[1]: got %q, want 5353:53/udp", result[1])
	}
}

func TestBuildServicePorts_EmptyProtocolDefaultsTCP(t *testing.T) {
	t.Parallel()

	ports := []swarm.PortConfig{
		{Protocol: "", PublishedPort: 9000, TargetPort: 9000},
	}

	result := buildServicePorts(ports)
	if len(result) != 1 {
		t.Fatalf("expected 1 port string, got %d", len(result))
	}
	if result[0] != "9000:9000/tcp" {
		t.Errorf("port[0]: got %q, want 9000:9000/tcp", result[0])
	}
}

func TestBuildServicePorts_FiltersZeroPorts(t *testing.T) {
	t.Parallel()

	ports := []swarm.PortConfig{
		{Protocol: swarm.PortConfigProtocolTCP, PublishedPort: 0, TargetPort: 80},  // no published port
		{Protocol: swarm.PortConfigProtocolTCP, PublishedPort: 8080, TargetPort: 0}, // no target port
		{Protocol: swarm.PortConfigProtocolTCP, PublishedPort: 443, TargetPort: 443}, // valid
	}

	result := buildServicePorts(ports)
	if len(result) != 1 {
		t.Fatalf("expected 1 valid port (zero ports filtered), got %d: %v", len(result), result)
	}
	if result[0] != "443:443/tcp" {
		t.Errorf("expected 443:443/tcp, got %q", result[0])
	}
}

func TestBuildServicePorts_Nil(t *testing.T) {
	t.Parallel()

	result := buildServicePorts(nil)
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

// ---------------------------------------------------------------------------
// buildComposeUpdateConfig tests
// ---------------------------------------------------------------------------

func TestBuildComposeUpdateConfig_AllFields(t *testing.T) {
	t.Parallel()

	uc := &swarm.UpdateConfig{
		Parallelism:   2,
		Delay:         5 * time.Second,
		FailureAction: "pause",
		Order:         "start-first",
	}

	result := buildComposeUpdateConfig(uc)
	if result == nil {
		t.Fatal("expected non-nil composeUpdateConfig")
	}
	if result.Parallelism == nil || *result.Parallelism != 2 {
		t.Errorf("Parallelism: expected &2, got %v", result.Parallelism)
	}
	if result.Delay != "5s" {
		t.Errorf("Delay: got %q, want 5s", result.Delay)
	}
	if result.FailureAction != "pause" {
		t.Errorf("FailureAction: got %q, want pause", result.FailureAction)
	}
	if result.Order != "start-first" {
		t.Errorf("Order: got %q, want start-first", result.Order)
	}
}

func TestBuildComposeUpdateConfig_Nil(t *testing.T) {
	t.Parallel()

	if result := buildComposeUpdateConfig(nil); result != nil {
		t.Errorf("expected nil for nil input, got %+v", result)
	}
}

func TestBuildComposeUpdateConfig_AllEmpty_ReturnsNil(t *testing.T) {
	t.Parallel()

	uc := &swarm.UpdateConfig{
		Parallelism:   0,
		Delay:         0,
		FailureAction: "",
		Order:         "",
	}

	result := buildComposeUpdateConfig(uc)
	if result != nil {
		t.Errorf("expected nil for all-zero UpdateConfig, got %+v", result)
	}
}

// ---------------------------------------------------------------------------
// buildComposeRestartPolicy tests
// ---------------------------------------------------------------------------

func TestBuildComposeRestartPolicy_AllFields(t *testing.T) {
	t.Parallel()

	delay := 3 * time.Second
	maxAttempts := uint64(5)
	window := 30 * time.Second

	rp := &swarm.RestartPolicy{
		Condition:   swarm.RestartPolicyConditionOnFailure,
		Delay:       &delay,
		MaxAttempts: &maxAttempts,
		Window:      &window,
	}

	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil composeRestartPolicy")
	}
	if result.Condition != "on-failure" {
		t.Errorf("Condition: got %q, want on-failure", result.Condition)
	}
	if result.Delay != "3s" {
		t.Errorf("Delay: got %q, want 3s", result.Delay)
	}
	if result.MaxAttempts == nil || *result.MaxAttempts != 5 {
		t.Errorf("MaxAttempts: expected &5, got %v", result.MaxAttempts)
	}
	if result.Window != "30s" {
		t.Errorf("Window: got %q, want 30s", result.Window)
	}
}

func TestBuildComposeRestartPolicy_Nil(t *testing.T) {
	t.Parallel()

	if result := buildComposeRestartPolicy(nil); result != nil {
		t.Errorf("expected nil for nil input, got %+v", result)
	}
}

func TestBuildComposeRestartPolicy_AllEmpty_ReturnsNil(t *testing.T) {
	t.Parallel()

	zero := time.Duration(0)
	rp := &swarm.RestartPolicy{
		Condition:   "",
		Delay:       &zero,
		MaxAttempts: nil,
		Window:      &zero,
	}

	result := buildComposeRestartPolicy(rp)
	if result != nil {
		t.Errorf("expected nil for all-zero RestartPolicy, got %+v", result)
	}
}

func TestBuildComposeRestartPolicy_ConditionOnly(t *testing.T) {
	t.Parallel()

	rp := &swarm.RestartPolicy{
		Condition: swarm.RestartPolicyConditionAny,
	}

	result := buildComposeRestartPolicy(rp)
	if result == nil {
		t.Fatal("expected non-nil when Condition is set")
	}
	if result.Condition != "any" {
		t.Errorf("Condition: got %q, want any", result.Condition)
	}
}

// ---------------------------------------------------------------------------
// buildComposeDeploy tests
// ---------------------------------------------------------------------------

func TestBuildComposeDeploy_ReplicatedMode(t *testing.T) {
	t.Parallel()

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
		t.Fatal("expected non-nil composeDeploy for replicated service")
	}
	if result.Mode != "replicated" {
		t.Errorf("Mode: got %q, want replicated", result.Mode)
	}
	if result.Replicas == nil || *result.Replicas != 3 {
		t.Errorf("Replicas: expected &3, got %v", result.Replicas)
	}
}

func TestBuildComposeDeploy_GlobalMode(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{Global: &swarm.GlobalService{}},
		},
	}

	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil composeDeploy for global service")
	}
	if result.Mode != "global" {
		t.Errorf("Mode: got %q, want global", result.Mode)
	}
	if result.Replicas != nil {
		t.Errorf("Replicas: expected nil for global mode, got %v", result.Replicas)
	}
}

func TestBuildComposeDeploy_WithUpdateConfig(t *testing.T) {
	t.Parallel()

	replicas := uint64(1)
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: &replicas},
			},
			UpdateConfig: &swarm.UpdateConfig{
				Parallelism:   1,
				Delay:         10 * time.Second,
				FailureAction: "rollback",
				Order:         "stop-first",
			},
		},
	}

	result := buildComposeDeploy(svc)
	if result == nil {
		t.Fatal("expected non-nil composeDeploy")
	}
	if result.Update == nil {
		t.Fatal("expected non-nil Update config")
	}
	if result.Update.FailureAction != "rollback" {
		t.Errorf("Update.FailureAction: got %q, want rollback", result.Update.FailureAction)
	}
}

func TestBuildComposeDeploy_NoModeNoConfigReturnsNil(t *testing.T) {
	t.Parallel()

	// A service with no mode settings and no update config
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{},
	}

	result := buildComposeDeploy(svc)
	if result != nil {
		t.Errorf("expected nil composeDeploy for service with no relevant fields, got %+v", result)
	}
}

// ---------------------------------------------------------------------------
// buildComposeService tests
// ---------------------------------------------------------------------------

func TestBuildComposeService_Basic(t *testing.T) {
	t.Parallel()

	replicas := uint64(2)
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				ContainerSpec: &swarm.ContainerSpec{
					Image: "redis:7",
				},
			},
			Mode: swarm.ServiceMode{
				Replicated: &swarm.ReplicatedService{Replicas: &replicas},
			},
			Annotations: swarm.Annotations{Labels: map[string]string{"app": "cache"}},
		},
		Endpoint: swarm.Endpoint{
			Spec: swarm.EndpointSpec{
				Ports: []swarm.PortConfig{
					{Protocol: swarm.PortConfigProtocolTCP, PublishedPort: 6379, TargetPort: 6379},
				},
			},
		},
	}

	cs := buildComposeService(svc)

	if cs.Image != "redis:7" {
		t.Errorf("Image: got %q, want redis:7", cs.Image)
	}
	if cs.Labels["app"] != "cache" {
		t.Errorf("Labels[app]: got %q, want cache", cs.Labels["app"])
	}
	if len(cs.Ports) != 1 || cs.Ports[0] != "6379:6379/tcp" {
		t.Errorf("Ports: got %v, want [6379:6379/tcp]", cs.Ports)
	}
	if cs.Deploy == nil {
		t.Error("expected Deploy to be set for replicated service")
	}
	if cs.Deploy != nil && cs.Deploy.Mode != "replicated" {
		t.Errorf("Deploy.Mode: got %q, want replicated", cs.Deploy.Mode)
	}
}
