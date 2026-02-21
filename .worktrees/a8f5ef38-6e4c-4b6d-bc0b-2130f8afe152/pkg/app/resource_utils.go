package app

import (
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ExtractFirstContainerImage returns the image of the first container in a PodSpec.
// Returns empty string if there are no containers.
func ExtractFirstContainerImage(spec corev1.PodSpec) string {
	if len(spec.Containers) > 0 {
		return spec.Containers[0].Image
	}
	return ""
}

// SafeReplicaCount safely extracts replica count from a pointer.
// Returns 0 if the pointer is nil.
func SafeReplicaCount(replicas *int32) int32 {
	if replicas != nil {
		return *replicas
	}
	return 0
}

// SafeLabels returns an empty map if labels is nil.
func SafeLabels(labels map[string]string) map[string]string {
	if labels == nil {
		return make(map[string]string)
	}
	return labels
}

// MergeLabels merges object labels with template labels.
// Object labels take precedence (template labels only fill in gaps).
func MergeLabels(objectLabels, templateLabels map[string]string) map[string]string {
	result := make(map[string]string)
	for k, v := range objectLabels {
		result[k] = v
	}
	for k, v := range templateLabels {
		if _, exists := result[k]; !exists {
			result[k] = v
		}
	}
	return result
}

// Int32Ptr returns a pointer to the given int32 value.
// Useful for creating replica count pointers in tests.
func Int32Ptr(i int32) *int32 {
	return &i
}

// FormatAge returns a human-readable age string from a creation timestamp.
// Returns "-" if the timestamp is zero.
func FormatAge(ts metav1.Time, now time.Time) string {
	if ts.Time.IsZero() {
		return "-"
	}
	return formatDuration(now.Sub(ts.Time))
}

// FormatAccessModes converts PersistentVolume access modes to short form (RWO, ROX, RWX, RWOP).
// Returns "-" for empty input.
func FormatAccessModes(modes []corev1.PersistentVolumeAccessMode) string {
	if len(modes) == 0 {
		return "-"
	}
	result := make([]string, len(modes))
	for i, mode := range modes {
		switch mode {
		case corev1.ReadWriteOnce:
			result[i] = "RWO"
		case corev1.ReadOnlyMany:
			result[i] = "ROX"
		case corev1.ReadWriteMany:
			result[i] = "RWX"
		case corev1.ReadWriteOncePod:
			result[i] = "RWOP"
		default:
			result[i] = string(mode)
		}
	}
	return strings.Join(result, ",")
}
