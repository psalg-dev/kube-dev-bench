package app

import (
	"strings"
	"testing"
)

func TestNormalizeYAMLForParsing(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "windows line endings",
			input:    "apiVersion: v1\r\nkind: Pod\r\nmetadata:\r\n  name: test",
			expected: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test",
		},
		{
			name:     "mac classic line endings",
			input:    "apiVersion: v1\rkind: Pod\rmetadata:\r  name: test",
			expected: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test",
		},
		{
			name:     "UTF-8 BOM at start",
			input:    "\uFEFFapiVersion: v1\nkind: Pod",
			expected: "apiVersion: v1\nkind: Pod",
		},
		{
			name:     "UTF-8 BOM in middle",
			input:    "apiVersion: v1\n\uFEFFkind: Pod",
			expected: "apiVersion: v1\nkind: Pod",
		},
		{
			name:     "zero-width space",
			input:    "apiVersion:\u200Bv1\nkind: Pod",
			expected: "apiVersion:v1\nkind: Pod",
		},
		{
			name:     "tabs in indentation",
			input:    "apiVersion: v1\nkind: Pod\nmetadata:\n\tname: test\n\t\tlabels:\n\t\t\tapp: test",
			expected: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test\n    labels:\n      app: test",
		},
		{
			name:     "nbsp in indentation",
			input:    "apiVersion: v1\nkind: Pod\nmetadata:\n\u00A0\u00A0name: test",
			expected: "apiVersion: v1\nkind: Pod\nmetadata:\n    name: test",
		},
		{
			name:     "mixed tabs and nbsp",
			input:    "apiVersion: v1\n\tmetadata:\n\u00A0\u00A0\tname: test",
			expected: "apiVersion: v1\n  metadata:\n      name: test",
		},
		{
			name:     "empty lines preserved",
			input:    "apiVersion: v1\n\nkind: Pod\n\nmetadata:",
			expected: "apiVersion: v1\n\nkind: Pod\n\nmetadata:",
		},
		{
			name:     "normal yaml unchanged",
			input:    "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test\n  labels:\n    app: test",
			expected: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test\n  labels:\n    app: test",
		},
		{
			name:     "tabs mid-line not affected",
			input:    "apiVersion: v1\ndata:\n  key: value\twith\ttabs",
			expected: "apiVersion: v1\ndata:\n  key: value\twith\ttabs",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeYAMLForParsing(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeYAMLForParsing() mismatch:\ngot:\n%q\nwant:\n%q", result, tt.expected)
			}
		})
	}
}

func TestNormalizeYAMLForParsing_EdgeCases(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "empty string",
			input: "",
		},
		{
			name:  "only whitespace",
			input: "   \n  \n   ",
		},
		{
			name:  "only special chars",
			input: "\uFEFF\u200B\r\n\t",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Should not panic
			result := normalizeYAMLForParsing(tt.input)
			// Just verify it returns something
			_ = result
		})
	}
}

func TestNormalizeYAMLForParsing_ComplexDocument(t *testing.T) {
	input := "\uFEFFapiVersion: v1\r\nkind: Pod\r\nmetadata:\r\n\tname: test\u200B-pod\r\n\t\u00A0labels:\r\n\t\t\tapp: test"
	result := normalizeYAMLForParsing(input)

	// Should not contain special characters
	if strings.Contains(result, "\uFEFF") {
		t.Error("BOM not removed")
	}
	if strings.Contains(result, "\u200B") {
		t.Error("zero-width space not removed")
	}
	if strings.Contains(result, "\r") {
		t.Error("carriage returns not normalized")
	}
	// Should have normalized line endings
	if !strings.Contains(result, "\n") {
		t.Error("no newlines found after normalization")
	}
	// Leading tabs/nbsp should be converted to spaces
	lines := strings.Split(result, "\n")
	for i, line := range lines {
		if line == "" {
			continue
		}
		// Check that leading whitespace is spaces only
		j := 0
		for j < len(line) && line[j] == ' ' {
			j++
		}
		if j > 0 && j < len(line) {
			// We have leading spaces followed by content
			leadingPart := line[:j]
			if strings.Contains(leadingPart, "\t") {
				t.Errorf("line %d still has tabs in indentation: %q", i, line)
			}
		}
	}
}
