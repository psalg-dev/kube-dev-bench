package docker

import (
	"strings"
	"testing"
)

func TestIsAlphaNumASCII(t *testing.T) {
	tests := []struct {
		name  string
		input byte
		want  bool
	}{
		{"lowercase a", 'a', true},
		{"lowercase z", 'z', true},
		{"uppercase A", 'A', true},
		{"uppercase Z", 'Z', true},
		{"digit 0", '0', true},
		{"digit 9", '9', true},
		{"dash", '-', false},
		{"underscore", '_', false},
		{"dot", '.', false},
		{"space", ' ', false},
		{"special char", '!', false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isAlphaNumASCII(tt.input)
			if got != tt.want {
				t.Errorf("isAlphaNumASCII(%c) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestSwarmTimestampedName_Basic(t *testing.T) {
	name := swarmTimestampedName("myconfig", "20240101-120000")
	expected := "myconfig_20240101-120000"
	if name != expected {
		t.Errorf("expected %s, got %s", expected, name)
	}
}

func TestSwarmTimestampedName_LongBaseName(t *testing.T) {
	// Create a base name that would exceed 64 chars when combined with suffix
	longBase := strings.Repeat("abcdefghij", 10) // 100 chars
	stamp := "20240101-120000"
	
	name := swarmTimestampedName(longBase, stamp)
	
	// Should be truncated to 64 chars or less
	if len(name) > swarmObjectNameMaxLen {
		t.Errorf("name too long: %d chars (max %d)", len(name), swarmObjectNameMaxLen)
	}
	
	// Should end with the timestamp suffix
	if !strings.HasSuffix(name, "_"+stamp) {
		t.Errorf("expected name to end with _%s, got %s", stamp, name)
	}
	
	// Should start with an alphanumeric
	if len(name) > 0 && !isAlphaNumASCII(name[0]) {
		t.Errorf("name should start with alphanumeric, got %c", name[0])
	}
}

func TestSwarmTimestampedName_TrailingNonAlphaNum(t *testing.T) {
	// Base name with trailing non-alphanumeric that would be at truncation point
	baseName := "myconfig---"
	stamp := "stamp"
	
	name := swarmTimestampedName(baseName, stamp)
	
	// Should trim trailing dashes before adding suffix
	// Name should be like "myconfig_stamp", not "myconfig---_stamp"
	expectedPrefix := "myconfig"
	if !strings.HasPrefix(name, expectedPrefix) {
		t.Errorf("expected name to start with %s, got %s", expectedPrefix, name)
	}
	
	// Check no trailing dashes before suffix
	parts := strings.Split(name, "_")
	if len(parts) > 0 {
		basePart := parts[0]
		if len(basePart) > 0 && !isAlphaNumASCII(basePart[len(basePart)-1]) {
			t.Errorf("base part should end with alphanumeric, got %c", basePart[len(basePart)-1])
		}
	}
}

func TestSwarmTimestampedName_LeadingNonAlphaNum(t *testing.T) {
	// Base name with leading non-alphanumeric
	baseName := "---myconfig"
	stamp := "stamp"
	
	name := swarmTimestampedName(baseName, stamp)
	
	// Should trim leading dashes
	if strings.HasPrefix(name, "-") || strings.HasPrefix(name, "_") || strings.HasPrefix(name, ".") {
		t.Errorf("name should not start with non-alphanumeric, got %s", name)
	}
	
	// Should start with alphanumeric
	if len(name) > 0 && !isAlphaNumASCII(name[0]) {
		t.Errorf("name should start with alphanumeric, got %c", name[0])
	}
}

func TestSwarmTimestampedName_EmptyBaseAfterTrim(t *testing.T) {
	// Base name that becomes empty after trimming
	baseName := "---___..."
	stamp := "stamp"
	
	name := swarmTimestampedName(baseName, stamp)
	
	// Should default to "obj" as base
	expected := "obj_stamp"
	if name != expected {
		t.Errorf("expected %s, got %s", expected, name)
	}
}

func TestSwarmTimestampedName_EmptyBase(t *testing.T) {
	name := swarmTimestampedName("", "stamp")
	
	expected := "obj_stamp"
	if name != expected {
		t.Errorf("expected %s, got %s", expected, name)
	}
}

func TestSwarmTimestampedName_MaxLength(t *testing.T) {
	// Test exact boundary conditions
	stamp := "stamp"
	maxBase := swarmObjectNameMaxLen - len("_") - len(stamp)
	baseName := strings.Repeat("a", maxBase)
	
	name := swarmTimestampedName(baseName, stamp)
	
	if len(name) != swarmObjectNameMaxLen {
		t.Errorf("expected exact length %d, got %d", swarmObjectNameMaxLen, len(name))
	}
	
	expectedName := baseName + "_" + stamp
	if name != expectedName {
		t.Errorf("expected %s, got %s", expectedName, name)
	}
}

func TestSwarmTimestampedName_TruncationWithNonAlphaNum(t *testing.T) {
	// Create a name that will be truncated right at a non-alphanumeric
	// Base: 50 'a's followed by dashes, stamp will cause truncation
	baseName := strings.Repeat("a", 50) + "---more"
	stamp := "longstamp"
	
	name := swarmTimestampedName(baseName, stamp)
	
	// Should not end with non-alphanumeric before the suffix separator
	parts := strings.Split(name, "_")
	if len(parts) > 0 {
		basePart := parts[0]
		if len(basePart) > 0 && !isAlphaNumASCII(basePart[len(basePart)-1]) {
			t.Errorf("base part should end with alphanumeric, got %c in %s", basePart[len(basePart)-1], name)
		}
	}
}

func TestSwarmTimestampedName_AllNonAlphaNum(t *testing.T) {
	// Base name with all non-alphanumeric characters
	baseName := "---___..."
	stamp := "12345"
	
	name := swarmTimestampedName(baseName, stamp)
	
	// Should use fallback
	expected := "obj_12345"
	if name != expected {
		t.Errorf("expected %s, got %s", expected, name)
	}
}

func TestSwarmTimestampedName_UnicodeCharacters(t *testing.T) {
	// Base name with unicode characters (>127)
	baseName := "config☃"
	stamp := "stamp"
	
	name := swarmTimestampedName(baseName, stamp)
	
	// Unicode should be trimmed
	// Should result in "config_stamp"
	expected := "config_stamp"
	if name != expected {
		t.Errorf("expected %s, got %s", expected, name)
	}
}

func TestSwarmTimestampedName_MixedCase(t *testing.T) {
	// Test with mixed case to ensure it's preserved
	baseName := "MyConfig"
	stamp := "STAMP"
	
	name := swarmTimestampedName(baseName, stamp)
	
	expected := "MyConfig_STAMP"
	if name != expected {
		t.Errorf("expected %s, got %s", expected, name)
	}
}
