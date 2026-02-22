package holmesgpt

import (
	"testing"

	"gopkg.in/yaml.v3"
)

func TestGetDefaultHelmValues_NonNilMap(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() unexpected error: %v", err)
	}
	if values == nil {
		t.Error("GetDefaultHelmValues() returned nil map")
	}
}

func TestGetDefaultHelmValues_ContainsExpectedKeys(t *testing.T) {
	values, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() unexpected error: %v", err)
	}

	// default-values.yaml must contain at least "toolsets"
	if _, ok := values["toolsets"]; !ok {
		t.Error("GetDefaultHelmValues() map missing expected key 'toolsets'")
	}
}

func TestGetDefaultHelmValuesYAML_NonEmpty(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()
	if len(raw) == 0 {
		t.Error("GetDefaultHelmValuesYAML() returned empty bytes")
	}
}

func TestGetDefaultHelmValuesYAML_ValidYAML(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()

	var out map[string]interface{}
	if err := yaml.Unmarshal(raw, &out); err != nil {
		t.Errorf("GetDefaultHelmValuesYAML() returned invalid YAML: %v", err)
	}
	if out == nil {
		t.Error("GetDefaultHelmValuesYAML() YAML parsed to nil map")
	}
}

func TestGetDefaultHelmValuesYAML_MatchesGetDefaultHelmValues(t *testing.T) {
	raw := GetDefaultHelmValuesYAML()

	var fromYAML map[string]interface{}
	if err := yaml.Unmarshal(raw, &fromYAML); err != nil {
		t.Fatalf("yaml.Unmarshal unexpected error: %v", err)
	}

	fromFunc, err := GetDefaultHelmValues()
	if err != nil {
		t.Fatalf("GetDefaultHelmValues() unexpected error: %v", err)
	}

	// Both must agree on the top-level keys present.
	for k := range fromYAML {
		if _, ok := fromFunc[k]; !ok {
			t.Errorf("key %q found in raw YAML but missing from GetDefaultHelmValues()", k)
		}
	}
	for k := range fromFunc {
		if _, ok := fromYAML[k]; !ok {
			t.Errorf("key %q found in GetDefaultHelmValues() but missing from raw YAML", k)
		}
	}
}
