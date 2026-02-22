package docker

import (
	"testing"
	"time"

	"github.com/docker/docker/api/types/swarm"
)

// TestExtractResources verifies that NanoCPU and memory values are preserved correctly.
func TestExtractResources_NanoCPUAndMemory(t *testing.T) {
	t.Parallel()

	const oneCPUNano = int64(1_000_000_000) // 1e9 NanoCPUs == 1.0 CPU
	const mem512MB = int64(512 * 1024 * 1024)

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Resources: &swarm.ResourceRequirements{
					Limits: &swarm.Limit{
						NanoCPUs:    oneCPUNano,
						MemoryBytes: mem512MB,
					},
				},
			},
		},
	}

	res := extractResources(svc)
	if res == nil {
		t.Fatal("expected non-nil resources info")
	}
	if res.Limits == nil {
		t.Fatal("expected non-nil Limits")
	}

	// NanoCPU=1e9 must map to exactly 1.0 CPU
	cpus := float64(res.Limits.NanoCPUs) / 1e9
	if cpus != 1.0 {
		t.Errorf("NanoCPU->CPU: got %.4f, want 1.0000", cpus)
	}

	// Raw NanoCPU value must be preserved
	if res.Limits.NanoCPUs != oneCPUNano {
		t.Errorf("NanoCPUs: got %d, want %d", res.Limits.NanoCPUs, oneCPUNano)
	}

	// 512MB memory must be preserved
	if res.Limits.MemoryBytes != mem512MB {
		t.Errorf("MemoryBytes: got %d, want %d", res.Limits.MemoryBytes, mem512MB)
	}

	// No Reservations were set
	if res.Reservations != nil {
		t.Errorf("expected nil Reservations, got %+v", res.Reservations)
	}
}

// TestExtractResources_Reservations verifies reservation fields are extracted.
func TestExtractResources_Reservations(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Resources: &swarm.ResourceRequirements{
					Reservations: &swarm.Resources{
						NanoCPUs:    500_000_000, // 0.5 CPU
						MemoryBytes: 256 * 1024 * 1024,
					},
				},
			},
		},
	}

	res := extractResources(svc)
	if res == nil {
		t.Fatal("expected non-nil resources info when Reservations are set")
	}
	if res.Reservations == nil {
		t.Fatal("expected non-nil Reservations")
	}
	if res.Reservations.NanoCPUs != 500_000_000 {
		t.Errorf("Reservations.NanoCPUs: got %d, want 500000000", res.Reservations.NanoCPUs)
	}
	if res.Limits != nil {
		t.Errorf("expected nil Limits when only Reservations set, got %+v", res.Limits)
	}
}

// TestExtractResources_BothLimitsAndReservations verifies that both limits and
// reservations can coexist.
func TestExtractResources_BothLimitsAndReservations(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Resources: &swarm.ResourceRequirements{
					Limits: &swarm.Limit{
						NanoCPUs:    2_000_000_000,
						MemoryBytes: 1 * 1024 * 1024 * 1024,
					},
					Reservations: &swarm.Resources{
						NanoCPUs:    500_000_000,
						MemoryBytes: 256 * 1024 * 1024,
					},
				},
			},
		},
	}

	res := extractResources(svc)
	if res == nil {
		t.Fatal("expected non-nil resources info")
	}
	if res.Limits == nil {
		t.Fatal("expected non-nil Limits")
	}
	if res.Reservations == nil {
		t.Fatal("expected non-nil Reservations")
	}
	if res.Limits.NanoCPUs != 2_000_000_000 {
		t.Errorf("Limits.NanoCPUs: got %d, want 2000000000", res.Limits.NanoCPUs)
	}
	if res.Reservations.NanoCPUs != 500_000_000 {
		t.Errorf("Reservations.NanoCPUs: got %d, want 500000000", res.Reservations.NanoCPUs)
	}
}

// TestExtractResources_Nil verifies nil is returned when there are no resources.
func TestExtractResources_Nil(t *testing.T) {
	t.Parallel()

	// No Resources set
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{},
		},
	}
	if res := extractResources(svc); res != nil {
		t.Errorf("expected nil for service with no resources, got %+v", res)
	}

	// Resources set but empty (no limits or reservations)
	svc2 := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Resources: &swarm.ResourceRequirements{},
			},
		},
	}
	if res := extractResources(svc2); res != nil {
		t.Errorf("expected nil for empty ResourceRequirements, got %+v", res)
	}
}

// TestExtractPlacement_ConstraintsAndMaxReplicas verifies placement constraints
// and max replica count are properly extracted.
func TestExtractPlacement_ConstraintsAndMaxReplicas(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Placement: &swarm.Placement{
					Constraints: []string{
						"node.role == manager",
						"node.labels.region == us-east",
					},
					MaxReplicas: 5,
				},
			},
		},
	}

	p := extractPlacement(svc)
	if p == nil {
		t.Fatal("expected non-nil placement info")
	}
	if len(p.Constraints) != 2 {
		t.Fatalf("expected 2 constraints, got %d: %v", len(p.Constraints), p.Constraints)
	}
	if p.Constraints[0] != "node.role == manager" {
		t.Errorf("Constraints[0]: got %q, want node.role == manager", p.Constraints[0])
	}
	if p.Constraints[1] != "node.labels.region == us-east" {
		t.Errorf("Constraints[1]: got %q", p.Constraints[1])
	}
	if p.MaxReplicas != 5 {
		t.Errorf("MaxReplicas: got %d, want 5", p.MaxReplicas)
	}
}

// TestExtractPlacement_SpreadPreferences verifies that spread preferences are
// formatted correctly.
func TestExtractPlacement_SpreadPreferences(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Placement: &swarm.Placement{
					Preferences: []swarm.PlacementPreference{
						{Spread: &swarm.SpreadOver{SpreadDescriptor: "node.labels.zone"}},
					},
				},
			},
		},
	}

	p := extractPlacement(svc)
	if p == nil {
		t.Fatal("expected non-nil placement info (preferences set)")
	}
	if len(p.Preferences) != 1 {
		t.Fatalf("expected 1 preference, got %d", len(p.Preferences))
	}
	if p.Preferences[0] != "spread:node.labels.zone" {
		t.Errorf("Preferences[0]: got %q, want spread:node.labels.zone", p.Preferences[0])
	}
}

// TestExtractPlacement_Nil verifies nil is returned when placement is not set
// or contains only zero values.
func TestExtractPlacement_Nil(t *testing.T) {
	t.Parallel()

	// No placement set
	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{},
		},
	}
	if p := extractPlacement(svc); p != nil {
		t.Errorf("expected nil for service with no placement, got %+v", p)
	}

	// Placement set but all empty
	svc2 := &swarm.Service{
		Spec: swarm.ServiceSpec{
			TaskTemplate: swarm.TaskSpec{
				Placement: &swarm.Placement{
					Constraints: []string{},
					Preferences: []swarm.PlacementPreference{},
					MaxReplicas: 0,
				},
			},
		},
	}
	if p := extractPlacement(svc2); p != nil {
		t.Errorf("expected nil for empty placement, got %+v", p)
	}
}

// TestExtractUpdateConfig_AllFields verifies all UpdateConfig fields are mapped.
func TestExtractUpdateConfig_AllFields(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			UpdateConfig: &swarm.UpdateConfig{
				Parallelism:     2,
				Delay:           5 * time.Second,
				FailureAction:   "pause",
				Monitor:         10 * time.Second,
				MaxFailureRatio: 0.25,
				Order:           "start-first",
			},
		},
	}

	uc := extractUpdateConfig(svc)
	if uc == nil {
		t.Fatal("expected non-nil UpdateConfig info")
	}
	if uc.Parallelism != 2 {
		t.Errorf("Parallelism: got %d, want 2", uc.Parallelism)
	}
	if uc.Delay != "5s" {
		t.Errorf("Delay: got %q, want 5s", uc.Delay)
	}
	if uc.FailureAction != "pause" {
		t.Errorf("FailureAction: got %q, want pause", uc.FailureAction)
	}
	if uc.Monitor != "10s" {
		t.Errorf("Monitor: got %q, want 10s", uc.Monitor)
	}
	// MaxFailureRatio is float32 in Docker API, float64 in our struct
	if uc.MaxFailureRatio != float64(float32(0.25)) {
		t.Errorf("MaxFailureRatio: got %f, want ~0.25", uc.MaxFailureRatio)
	}
	if uc.Order != "start-first" {
		t.Errorf("Order: got %q, want start-first", uc.Order)
	}
}

// TestExtractUpdateConfig_Nil verifies nil is returned when UpdateConfig is absent.
func TestExtractUpdateConfig_Nil(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			// No UpdateConfig
		},
	}
	if uc := extractUpdateConfig(svc); uc != nil {
		t.Errorf("expected nil UpdateConfig for service without update config, got %+v", uc)
	}
}

// TestExtractUpdateConfig_ZeroParallelism verifies that zero parallelism
// (unlimited) is preserved.
func TestExtractUpdateConfig_ZeroParallelism(t *testing.T) {
	t.Parallel()

	svc := &swarm.Service{
		Spec: swarm.ServiceSpec{
			UpdateConfig: &swarm.UpdateConfig{
				Parallelism:   0, // 0 means unlimited
				FailureAction: "continue",
				Order:         "stop-first",
			},
		},
	}

	uc := extractUpdateConfig(svc)
	if uc == nil {
		t.Fatal("expected non-nil UpdateConfig info")
	}
	if uc.Parallelism != 0 {
		t.Errorf("Parallelism: got %d, want 0 (unlimited)", uc.Parallelism)
	}
	if uc.Order != "stop-first" {
		t.Errorf("Order: got %q, want stop-first", uc.Order)
	}
}
