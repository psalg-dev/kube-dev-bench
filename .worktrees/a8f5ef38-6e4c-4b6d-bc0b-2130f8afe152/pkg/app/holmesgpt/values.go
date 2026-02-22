package holmesgpt

import (
	_ "embed"

	"gopkg.in/yaml.v3"
)

//go:embed default-values.yaml
var defaultValuesYAML []byte

// GetDefaultHelmValues parses and returns the default Helm values for HolmesGPT deployment.
// The values are embedded from default-values.yaml at compile time.
func GetDefaultHelmValues() (map[string]interface{}, error) {
	var values map[string]interface{}
	if err := yaml.Unmarshal(defaultValuesYAML, &values); err != nil {
		return nil, err
	}
	return values, nil
}

// GetDefaultHelmValuesYAML returns the raw YAML content of the default Helm values.
func GetDefaultHelmValuesYAML() []byte {
	return defaultValuesYAML
}
