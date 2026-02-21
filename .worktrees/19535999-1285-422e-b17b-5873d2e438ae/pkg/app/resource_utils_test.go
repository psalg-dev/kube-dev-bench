package app

import (
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestExtractFirstContainerImage(t *testing.T) {
	tests := []struct {
		name     string
		spec     corev1.PodSpec
		expected string
	}{
		{
			name:     "empty containers",
			spec:     corev1.PodSpec{Containers: []corev1.Container{}},
			expected: "",
		},
		{
			name: "single container",
			spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{Image: "nginx:latest"},
				},
			},
			expected: "nginx:latest",
		},
		{
			name: "multiple containers returns first",
			spec: corev1.PodSpec{
				Containers: []corev1.Container{
					{Image: "redis:6"},
					{Image: "nginx:1.19"},
				},
			},
			expected: "redis:6",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractFirstContainerImage(tt.spec)
			if result != tt.expected {
				t.Errorf("ExtractFirstContainerImage() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestSafeReplicaCount(t *testing.T) {
	tests := []struct {
		name     string
		replicas *int32
		expected int32
	}{
		{
			name:     "nil pointer",
			replicas: nil,
			expected: 0,
		},
		{
			name:     "zero replicas",
			replicas: Int32Ptr(0),
			expected: 0,
		},
		{
			name:     "positive replicas",
			replicas: Int32Ptr(3),
			expected: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SafeReplicaCount(tt.replicas)
			if result != tt.expected {
				t.Errorf("SafeReplicaCount() = %d, want %d", result, tt.expected)
			}
		})
	}
}

func TestSafeLabels(t *testing.T) {
	tests := []struct {
		name     string
		labels   map[string]string
		expected map[string]string
	}{
		{
			name:     "nil labels",
			labels:   nil,
			expected: map[string]string{},
		},
		{
			name:     "empty labels",
			labels:   map[string]string{},
			expected: map[string]string{},
		},
		{
			name:     "with labels",
			labels:   map[string]string{"app": "test"},
			expected: map[string]string{"app": "test"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SafeLabels(tt.labels)
			if result == nil {
				t.Error("SafeLabels() returned nil")
			}
			if len(result) != len(tt.expected) {
				t.Errorf("SafeLabels() = %v, want %v", result, tt.expected)
			}
			for k, v := range tt.expected {
				if result[k] != v {
					t.Errorf("SafeLabels()[%s] = %q, want %q", k, result[k], v)
				}
			}
		})
	}
}

func TestMergeLabels(t *testing.T) {
	tests := []struct {
		name           string
		objectLabels   map[string]string
		templateLabels map[string]string
		expected       map[string]string
	}{
		{
			name:           "both nil",
			objectLabels:   nil,
			templateLabels: nil,
			expected:       map[string]string{},
		},
		{
			name:           "object labels only",
			objectLabels:   map[string]string{"app": "test"},
			templateLabels: nil,
			expected:       map[string]string{"app": "test"},
		},
		{
			name:           "template labels only",
			objectLabels:   nil,
			templateLabels: map[string]string{"version": "v1"},
			expected:       map[string]string{"version": "v1"},
		},
		{
			name:           "object labels take precedence",
			objectLabels:   map[string]string{"app": "object-value"},
			templateLabels: map[string]string{"app": "template-value"},
			expected:       map[string]string{"app": "object-value"},
		},
		{
			name:           "merge non-overlapping labels",
			objectLabels:   map[string]string{"app": "test"},
			templateLabels: map[string]string{"version": "v1"},
			expected:       map[string]string{"app": "test", "version": "v1"},
		},
		{
			name:           "mixed overlapping and non-overlapping",
			objectLabels:   map[string]string{"app": "test", "tier": "frontend"},
			templateLabels: map[string]string{"app": "ignored", "env": "prod"},
			expected:       map[string]string{"app": "test", "tier": "frontend", "env": "prod"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MergeLabels(tt.objectLabels, tt.templateLabels)
			if len(result) != len(tt.expected) {
				t.Errorf("MergeLabels() = %v, want %v", result, tt.expected)
			}
			for k, v := range tt.expected {
				if result[k] != v {
					t.Errorf("MergeLabels()[%s] = %q, want %q", k, result[k], v)
				}
			}
		})
	}
}

func TestInt32Ptr(t *testing.T) {
	ptr := Int32Ptr(5)
	if ptr == nil {
		t.Fatal("Int32Ptr() returned nil")
	}
	if *ptr != 5 {
		t.Errorf("Int32Ptr(5) = %d, want 5", *ptr)
	}
}

func TestFormatAge(t *testing.T) {
	now := time.Date(2026, 2, 6, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		ts       metav1.Time
		expected string
	}{
		{
			name:     "zero timestamp returns dash",
			ts:       metav1.Time{},
			expected: "-",
		},
		{
			name:     "seconds ago",
			ts:       metav1.NewTime(now.Add(-30 * time.Second)),
			expected: "30s",
		},
		{
			name:     "minutes ago",
			ts:       metav1.NewTime(now.Add(-5 * time.Minute)),
			expected: "5m",
		},
		{
			name:     "hours ago",
			ts:       metav1.NewTime(now.Add(-3 * time.Hour)),
			expected: "3h",
		},
		{
			name:     "days ago",
			ts:       metav1.NewTime(now.Add(-48 * time.Hour)),
			expected: "2d",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatAge(tt.ts, now)
			if result != tt.expected {
				t.Errorf("FormatAge() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestFormatAccessModes(t *testing.T) {
	tests := []struct {
		name     string
		modes    []corev1.PersistentVolumeAccessMode
		expected string
	}{
		{
			name:     "empty returns dash",
			modes:    nil,
			expected: "-",
		},
		{
			name:     "ReadWriteOnce",
			modes:    []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			expected: "RWO",
		},
		{
			name:     "ReadOnlyMany",
			modes:    []corev1.PersistentVolumeAccessMode{corev1.ReadOnlyMany},
			expected: "ROX",
		},
		{
			name:     "ReadWriteMany",
			modes:    []corev1.PersistentVolumeAccessMode{corev1.ReadWriteMany},
			expected: "RWX",
		},
		{
			name:     "ReadWriteOncePod",
			modes:    []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOncePod},
			expected: "RWOP",
		},
		{
			name: "multiple modes",
			modes: []corev1.PersistentVolumeAccessMode{
				corev1.ReadWriteOnce,
				corev1.ReadOnlyMany,
			},
			expected: "RWO,ROX",
		},
		{
			name:     "unknown mode passthrough",
			modes:    []corev1.PersistentVolumeAccessMode{"CustomMode"},
			expected: "CustomMode",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatAccessModes(tt.modes)
			if result != tt.expected {
				t.Errorf("FormatAccessModes() = %q, want %q", result, tt.expected)
			}
		})
	}
}
