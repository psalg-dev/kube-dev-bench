package app

import (
	"testing"
	"time"
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

func TestListPVCFilesFromPod_ParsesLsOutput(t *testing.T) {
	a := NewApp()
	// stub exec to return predictable ls output
	lsOut := `-rw-r--r-- 1 root root 123 2026-02-22T12:00:00 file1.txt
	drwxr-xr-x 2 root root 4096 2026-02-22T12:01:00 dir1
	lrwxrwxrwx 1 root root 5 2026-02-22T12:02:00 link -> target`
	a.TestExecInPod = func(namespace, pod, container string, command []string, timeout time.Duration) (string, error) {
		return lsOut, nil
	}

	entries, err := a.listPVCFilesFromPod("default", "mypod", "container", "/mnt/claim", "", "/")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	if entries[0].Name != "dir1" {
		t.Errorf("expected dir1 first, got %s", entries[0].Name)
	}
}
