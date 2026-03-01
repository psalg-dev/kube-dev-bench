package app

import (
	"context"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	fake "k8s.io/client-go/kubernetes/fake"
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

func TestListPVCFiles_ParsesLsAndReturnsEntries(t *testing.T) {
	lsOutput := `-rw-r--r-- 1 root root 100 2024-01-01T00:00:00 file.txt
	drwxr-xr-x 2 root root 4096 2024-01-01T00:00:00 subdir/
	lrwxrwxrwx 1 root root 7 2024-01-01T00:00:00 link -> file.txt

	total 12`

	execStub := func(namespace, pod, container string, command []string, timeout time.Duration) (string, error) {
		cmd := strings.Join(command, " ")
		if strings.Contains(cmd, "ls -alp") {
			return lsOutput, nil
		}
		return "", nil
	}

	// Create a PVC
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "mypvc", Namespace: "default"},
		Status:     corev1.PersistentVolumeClaimStatus{Phase: corev1.ClaimBound},
	}
	// Create a pod that mounts the PVC and is ready
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "mypod",
			Namespace: "default",
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{
				Name:         "c1",
				Image:        "busybox",
				VolumeMounts: []corev1.VolumeMount{{Name: "vol", MountPath: "/data"}},
			}},
			Volumes: []corev1.Volume{{
				Name: "vol",
				VolumeSource: corev1.VolumeSource{
					PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
						ClaimName: "mypvc",
					},
				},
			}},
		},
		Status: corev1.PodStatus{
			Phase:             corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{{Name: "c1", Ready: true}},
		},
	}

	cs := fake.NewSimpleClientset(pvc, pod)
	a := &App{
		ctx:           context.Background(),
		testClientset: cs,
		TestExecInPod: execStub,
	}

	entries, err := a.ListPVCFiles("default", "mypvc", "/data")
	if err != nil {
		t.Fatalf("ListPVCFiles returned error: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d: %+v", len(entries), entries)
	}

	var foundFile, foundDir, foundLink bool
	for _, e := range entries {
		switch e.Name {
		case "file.txt":
			foundFile = true
			if e.Path != "/data/file.txt" {
				t.Errorf("file path mismatch: got %q", e.Path)
			}
		case "subdir/":
			foundDir = true
			if !e.IsDir {
				t.Errorf("expected subdir to be a dir")
			}
		case "link":
			foundLink = true
			if !e.IsSymlink {
				t.Errorf("expected link to be symlink")
			}
		}
	}
	if !foundFile || !foundDir || !foundLink {
		t.Fatalf("missing expected entries: file=%v dir=%v link=%v", foundFile, foundDir, foundLink)
	}

	// Also call with root path
	_, err = a.ListPVCFiles("default", "mypvc", "/")
	if err != nil {
		t.Fatalf("ListPVCFiles root returned error: %v", err)
	}
}
