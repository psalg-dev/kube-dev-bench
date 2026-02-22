package docker

import (
	"testing"

	"github.com/docker/docker/api/types/container"
)

// ---------------------------------------------------------------------------
// healthCheckToInfo tests
// ---------------------------------------------------------------------------

func TestHealthCheckToInfo_Nil(t *testing.T) {
	t.Parallel()

	if got := healthCheckToInfo(nil); got != nil {
		t.Errorf("expected nil for nil input, got %+v", got)
	}
}

func TestHealthCheckToInfo_PopulatesAllFields(t *testing.T) {
	t.Parallel()

	import_dur := func(d int) interface{} { return d }
	_ = import_dur

	hc := &container.HealthConfig{
		Test:     []string{"CMD", "echo", "ok"},
		Retries:  5,
	}

	result := healthCheckToInfo(hc)
	if result == nil {
		t.Fatal("expected non-nil SwarmHealthCheckInfo")
	}
	if len(result.Test) != 3 {
		t.Errorf("Test: expected 3 elements, got %d", len(result.Test))
	}
	if result.Test[0] != "CMD" {
		t.Errorf("Test[0]: expected CMD, got %q", result.Test[0])
	}
	if result.Retries != 5 {
		t.Errorf("Retries: expected 5, got %d", result.Retries)
	}
}

// ---------------------------------------------------------------------------
// isSwarmClientValid tests
// ---------------------------------------------------------------------------

func TestIsSwarmClientValid_NilInterface(t *testing.T) {
	t.Parallel()

	// Untyped nil interface
	if isSwarmClientValid(nil) {
		t.Error("expected false for nil interface")
	}
}

func TestIsSwarmClientValid_TypedNilPointer(t *testing.T) {
	t.Parallel()

	// A typed nil pointer (non-nil interface but nil underlying value)
	var cli *fakeDockerClient
	if isSwarmClientValid(cli) {
		t.Error("expected false for typed nil pointer")
	}
}

func TestIsSwarmClientValid_ValidClient(t *testing.T) {
	t.Parallel()

	cli := &fakeDockerClient{}
	if !isSwarmClientValid(cli) {
		t.Error("expected true for valid non-nil client")
	}
}

// ---------------------------------------------------------------------------
// safeInt64FromUint64 tests
// ---------------------------------------------------------------------------

func TestSafeInt64FromUint64_Normal(t *testing.T) {
	t.Parallel()

	const input = uint64(42)
	if got := safeInt64FromUint64(input); got != 42 {
		t.Errorf("expected 42, got %d", got)
	}
}

func TestSafeInt64FromUint64_MaxInt64(t *testing.T) {
	t.Parallel()

	const input = uint64(9223372036854775807) // math.MaxInt64
	got := safeInt64FromUint64(input)
	if got != 9223372036854775807 {
		t.Errorf("expected MaxInt64, got %d", got)
	}
}

func TestSafeInt64FromUint64_Overflow(t *testing.T) {
	t.Parallel()

	// uint64 value larger than MaxInt64 should be clamped
	const input = uint64(9223372036854775808) // MaxInt64 + 1
	got := safeInt64FromUint64(input)
	const want = int64(9223372036854775807) // MaxInt64
	if got != want {
		t.Errorf("expected clamped MaxInt64=%d, got %d", want, got)
	}
}

func TestSafeInt64FromUint64_MaxUint64(t *testing.T) {
	t.Parallel()

	const input = ^uint64(0) // MaxUint64
	got := safeInt64FromUint64(input)
	const want = int64(9223372036854775807)
	if got != want {
		t.Errorf("expected clamped MaxInt64=%d, got %d", want, got)
	}
}

// ---------------------------------------------------------------------------
// prettyJSON tests
// ---------------------------------------------------------------------------

func TestPrettyJSON_ValidJSON(t *testing.T) {
	t.Parallel()

	input := []byte(`{"foo":"bar","num":42}`)
	result := prettyJSON(input)

	if result == "" {
		t.Fatal("expected non-empty result for valid JSON")
	}
	// Should contain indented content
	if result == string(input) {
		t.Error("expected indented output, got same as input")
	}
}

func TestPrettyJSON_Empty(t *testing.T) {
	t.Parallel()

	if got := prettyJSON(nil); got != "" {
		t.Errorf("expected empty for nil input, got %q", got)
	}
	if got := prettyJSON([]byte{}); got != "" {
		t.Errorf("expected empty for empty input, got %q", got)
	}
	if got := prettyJSON([]byte("  \t\n")); got != "" {
		t.Errorf("expected empty for whitespace-only input, got %q", got)
	}
}

func TestPrettyJSON_InvalidJSON(t *testing.T) {
	t.Parallel()

	input := []byte(`not valid json`)
	result := prettyJSON(input)

	// Should fall back to raw string
	if result != string(input) {
		t.Errorf("expected raw fallback for invalid JSON, got %q", result)
	}
}
