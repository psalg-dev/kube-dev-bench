package app

import (
	"testing"
)

// Tests for sanitizeName function
func TestSanitizeName_Simple(t *testing.T) {
	result := sanitizeName("simple", 63)
	if result != "simple" {
		t.Errorf("sanitizeName(\"simple\", 63) = %q, want %q", result, "simple")
	}
}

func TestSanitizeName_UpperCase(t *testing.T) {
	result := sanitizeName("UPPERCASE", 63)
	if result != "uppercase" {
		t.Errorf("sanitizeName(\"UPPERCASE\", 63) = %q, want %q", result, "uppercase")
	}
}

func TestSanitizeName_SpecialChars(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		max      int
		expected string
	}{
		{"underscores", "my_pvc_name", 63, "my-pvc-name"},
		{"dots", "my.pvc.name", 63, "my-pvc-name"},
		{"multiple special", "my@pvc#name!", 63, "my-pvc-name"},
		{"spaces", "my pvc name", 63, "my-pvc-name"},
		{"mixed case", "MyPvcName", 63, "mypvcname"},
		{"leading dashes", "---test", 63, "test"},
		{"trailing dashes", "test---", 63, "test"},
		{"both ends dashes", "---test---", 63, "test"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := sanitizeName(tc.input, tc.max)
			if result != tc.expected {
				t.Errorf("sanitizeName(%q, %d) = %q, want %q", tc.input, tc.max, result, tc.expected)
			}
		})
	}
}

func TestSanitizeName_MaxLength(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		max      int
		expected string
	}{
		{"exact length", "abc", 3, "abc"},
		{"truncate", "abcdef", 3, "abc"},
		{"no truncate needed", "ab", 5, "ab"},
		{"long input", "verylongnamethatexceedsmax", 10, "verylongna"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := sanitizeName(tc.input, tc.max)
			if result != tc.expected {
				t.Errorf("sanitizeName(%q, %d) = %q, want %q", tc.input, tc.max, result, tc.expected)
			}
		})
	}
}

func TestSanitizeName_Empty(t *testing.T) {
	// Empty string should return default "pvc"
	result := sanitizeName("", 63)
	if result != "pvc" {
		t.Errorf("sanitizeName(\"\", 63) = %q, want %q", result, "pvc")
	}
}

func TestSanitizeName_AllSpecialChars(t *testing.T) {
	// All special chars should be replaced with dashes, then trimmed, resulting in empty -> "pvc"
	result := sanitizeName("@#$%", 63)
	if result != "pvc" {
		t.Errorf("sanitizeName(\"@#$%%\", 63) = %q, want %q", result, "pvc")
	}
}

func TestSanitizeName_Numbers(t *testing.T) {
	result := sanitizeName("pvc123", 63)
	if result != "pvc123" {
		t.Errorf("sanitizeName(\"pvc123\", 63) = %q, want %q", result, "pvc123")
	}
}
