package holmesgpt

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestGetDefaultHelmValues_ReturnsNonNilMap(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() unexpected error: %v", err)
	}
	if values == nil {
		t.Error("GetDefaultHelmValues() returned nil map")
	}
}

func TestGetDefaultHelmValues_MapIsNonEmpty(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() unexpected error: %v", err)
	}
	if len(values) == 0 {
		t.Error("GetDefaultHelmValues() returned empty map; expected at least one key")
	}
}

func TestGetDefaultHelmValuesYAML_NonEmpty(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()
	if len(raw) == 0 {
		t.Error("GetDefaultHelmValuesYAML() returned empty bytes")
	}
}

func TestGetDefaultHelmValuesYAML_ParseableYAML(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()

	var out interface{}
	if err := yaml.Unmarshal(raw, &out); err != nil {
		t.Errorf("GetDefaultHelmValuesYAML() produced unparseable YAML: %v", err)
	}
}

func TestGetDefaultHelmValuesYAML_ContainsYAMLContent(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()
	content := string(raw)

	// The embedded YAML should not be just whitespace/empty
	if strings.TrimSpace(content) == "" {
		t.Error("GetDefaultHelmValuesYAML() returned only whitespace")
	}
}

func TestGetDefaultHelmValues_ConsistentWithRawYAML(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() error: %v", err)
	}

	raw := GetDefaultHelmValuesYAML()
	var rawValues map[string]interface{}
	if err := yaml.Unmarshal(raw, &rawValues); err != nil {
		t.Fatalf("yaml.Unmarshal of raw YAML error: %v", err)
	}

	// Both should have the same number of top-level keys
	if len(values) != len(rawValues) {
		t.Errorf("key count mismatch: GetDefaultHelmValues=%d, raw YAML=%d", len(values), len(rawValues))
	}
}
