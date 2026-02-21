package holmesgpt

import (
	"testing"

	"gopkg.in/yaml.v3"
)

// ----------------------------------------------------------------------------
// TestGetDefaultHelmValues
// ----------------------------------------------------------------------------

// TestGetDefaultHelmValues_NonNilMap verifies GetDefaultHelmValues returns a
// non-nil, non-empty map.
func TestGetDefaultHelmValues_NonNilMap(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() unexpected error: %v", err)
	}
	if values == nil {
		t.Fatal("GetDefaultHelmValues() returned nil map")
	}
	if len(values) == 0 {
		t.Error("GetDefaultHelmValues() returned empty map; expected at least one key")
	}
}

// TestGetDefaultHelmValues_ContainsKnownKeys checks for expected top-level keys.
func TestGetDefaultHelmValues_ContainsKnownKeys(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() error: %v", err)
	}

	for _, key := range []string{"toolsets", "additionalEnvVars"} {
		if _, ok := values[key]; !ok {
			t.Errorf("GetDefaultHelmValues() missing expected key %q", key)
		}
	}
}

// TestGetDefaultHelmValues_ToolsetsIsMap verifies the toolsets value is non-nil.
func TestGetDefaultHelmValues_ToolsetsIsMap(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() error: %v", err)
	}

	toolsets, ok := values["toolsets"]
	if !ok {
		t.Fatal("GetDefaultHelmValues() missing 'toolsets' key")
	}
	if toolsets == nil {
		t.Error("GetDefaultHelmValues() 'toolsets' value is nil")
	}
}

// TestGetDefaultHelmValues_InvalidYAML_ReturnsError verifies the error path by
// temporarily replacing the embedded bytes with invalid YAML.
func TestGetDefaultHelmValues_InvalidYAML_ReturnsError(t *testing.T) {
	orig := defaultValuesYAML
	defaultValuesYAML = []byte("{\x00invalid yaml:\n-bad")
	t.Cleanup(func() { defaultValuesYAML = orig })

	if _, err := GetDefaultHelmValues(); err == nil {
		t.Error("GetDefaultHelmValues() expected error for invalid YAML, got nil")
	}
}

// ----------------------------------------------------------------------------
// TestGetDefaultHelmValuesYAML
// ----------------------------------------------------------------------------

// TestGetDefaultHelmValuesYAML_NonEmpty verifies the raw YAML is non-empty.
func TestGetDefaultHelmValuesYAML_NonEmpty(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()
	if len(raw) == 0 {
		t.Error("GetDefaultHelmValuesYAML() returned empty bytes")
	}
}

// TestGetDefaultHelmValuesYAML_ValidYAML verifies the raw bytes unmarshal
// without error — the primary acceptance-criterion test.
func TestGetDefaultHelmValuesYAML_ValidYAML(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()

	var out map[string]interface{}
	if err := yaml.Unmarshal(raw, &out); err != nil {
		t.Fatalf("GetDefaultHelmValuesYAML() returned non-parseable YAML: %v", err)
	}
	if out == nil {
		t.Error("GetDefaultHelmValuesYAML() parsed to nil map")
	}
}

// TestGetDefaultHelmValuesYAML_Idempotent verifies repeated calls return the
// same bytes.
func TestGetDefaultHelmValuesYAML_Idempotent(t *testing.T) {
	first := GetDefaultHelmValuesYAML()
	second := GetDefaultHelmValuesYAML()

	if string(first) != string(second) {
		t.Error("GetDefaultHelmValuesYAML() returned different bytes on repeated calls")
	}
}

// TestGetDefaultHelmValues_Consistent ensures both helpers return equivalent data.
func TestGetDefaultHelmValues_Consistent(t *testing.T) {
	fromFunc, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() error: %v", err)
	}

	raw := GetDefaultHelmValuesYAML()
	var fromRaw map[string]interface{}
	if err := yaml.Unmarshal(raw, &fromRaw); err != nil {
		t.Fatalf("yaml.Unmarshal of raw YAML error: %v", err)
	}

	if len(fromFunc) != len(fromRaw) {
		t.Errorf("key count mismatch: GetDefaultHelmValues()=%d, raw=%d", len(fromFunc), len(fromRaw))
	}

	for k := range fromFunc {
		if _, ok := fromRaw[k]; !ok {
			t.Errorf("key %q present in GetDefaultHelmValues() but not in raw YAML", k)
		}
	}
}
