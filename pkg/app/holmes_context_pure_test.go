package app

import (
	"strings"
	"testing"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
)

// ---------------------------------------------------------------------------
// TestWriteHPAConditions – pure function from holmes_context.go
// ---------------------------------------------------------------------------

func TestWriteHPAConditions(t *testing.T) {
	t.Run("empty conditions does nothing", func(t *testing.T) {
		var sb strings.Builder
		writeHPAConditions(&sb, nil)
		if sb.Len() != 0 {
			t.Errorf("expected empty output for nil conditions, got: %q", sb.String())
		}
	})

	t.Run("single condition with reason and message", func(t *testing.T) {
		var sb strings.Builder
		conds := []autoscalingv2.HorizontalPodAutoscalerCondition{
			{
				Type:    autoscalingv2.ScalingActive,
				Status:  corev1.ConditionTrue,
				Reason:  "ValidMetricFound",
				Message: "the HPA was able to successfully calculate a replica count",
			},
		}
		writeHPAConditions(&sb, conds)
		out := sb.String()
		if !strings.Contains(out, "ScalingActive") {
			t.Errorf("expected condition type in output: %s", out)
		}
		if !strings.Contains(out, "ValidMetricFound") {
			t.Errorf("expected Reason in output: %s", out)
		}
		if !strings.Contains(out, "successfully calculate") {
			t.Errorf("expected Message in output: %s", out)
		}
	})

	t.Run("condition without reason or message", func(t *testing.T) {
		var sb strings.Builder
		conds := []autoscalingv2.HorizontalPodAutoscalerCondition{
			{
				Type:   autoscalingv2.AbleToScale,
				Status: corev1.ConditionFalse,
			},
		}
		writeHPAConditions(&sb, conds)
		out := sb.String()
		if !strings.Contains(out, "AbleToScale") {
			t.Errorf("expected condition type in output: %s", out)
		}
		// Should not have "Reason:" or "Message:" since those fields are empty
		if strings.Contains(out, "Reason:") {
			t.Errorf("should not have empty Reason: %s", out)
		}
	})

	t.Run("multiple conditions", func(t *testing.T) {
		var sb strings.Builder
		conds := []autoscalingv2.HorizontalPodAutoscalerCondition{
			{Type: autoscalingv2.ScalingActive, Status: corev1.ConditionTrue},
			{Type: autoscalingv2.AbleToScale, Status: corev1.ConditionFalse, Reason: "ScaleDownBlocked"},
		}
		writeHPAConditions(&sb, conds)
		out := sb.String()
		if !strings.Contains(out, "ScalingActive") {
			t.Errorf("expected first condition: %s", out)
		}
		if !strings.Contains(out, "ScaleDownBlocked") {
			t.Errorf("expected Reason in second condition: %s", out)
		}
	})
}

// ---------------------------------------------------------------------------
// TestWriteJobConditions – pure function from holmes_context.go
// ---------------------------------------------------------------------------

func TestWriteJobConditions(t *testing.T) {
	t.Run("empty conditions does nothing", func(t *testing.T) {
		var sb strings.Builder
		writeJobConditions(&sb, nil)
		if sb.Len() != 0 {
			t.Errorf("expected empty output for nil conditions, got: %q", sb.String())
		}
	})

	t.Run("single condition with message", func(t *testing.T) {
		var sb strings.Builder
		conds := []batchv1.JobCondition{
			{
				Type:    batchv1.JobComplete,
				Status:  corev1.ConditionTrue,
				Message: "Job completed successfully",
			},
		}
		writeJobConditions(&sb, conds)
		out := sb.String()
		if !strings.Contains(out, "Complete") {
			t.Errorf("expected condition type in output: %s", out)
		}
		if !strings.Contains(out, "Job completed successfully") {
			t.Errorf("expected message in output: %s", out)
		}
	})

	t.Run("condition without message", func(t *testing.T) {
		var sb strings.Builder
		conds := []batchv1.JobCondition{
			{
				Type:   batchv1.JobFailed,
				Status: corev1.ConditionTrue,
			},
		}
		writeJobConditions(&sb, conds)
		out := sb.String()
		if !strings.Contains(out, "Failed") {
			t.Errorf("expected condition type in output: %s", out)
		}
		// Should not have "Message:" since field is empty
		if strings.Contains(out, "Message:") {
			t.Errorf("should not have empty Message: %s", out)
		}
	})

	t.Run("multiple conditions", func(t *testing.T) {
		var sb strings.Builder
		conds := []batchv1.JobCondition{
			{Type: batchv1.JobComplete, Status: corev1.ConditionTrue},
			{Type: batchv1.JobFailed, Status: corev1.ConditionFalse, Message: "BackoffLimitExceeded"},
		}
		writeJobConditions(&sb, conds)
		out := sb.String()
		if !strings.Contains(out, "BackoffLimitExceeded") {
			t.Errorf("expected message in output: %s", out)
		}
	})
}

// ---------------------------------------------------------------------------
// TestGetPVVolumeType_AdditionalTypes – covers missing switch cases
// ---------------------------------------------------------------------------

func TestGetPVVolumeType_AdditionalTypes(t *testing.T) {
	tests := []struct {
		name string
		spec corev1.PersistentVolumeSpec
		want string
	}{
		{
			name: "AWSElasticBlockStore",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					AWSElasticBlockStore: &corev1.AWSElasticBlockStoreVolumeSource{VolumeID: "vol-1"},
				},
			},
			want: "AWSElasticBlockStore",
		},
		{
			name: "Cinder",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					Cinder: &corev1.CinderPersistentVolumeSource{VolumeID: "cinder-vol"},
				},
			},
			want: "Cinder",
		},
		{
			name: "FlexVolume",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					FlexVolume: &corev1.FlexPersistentVolumeSource{Driver: "flex-driver"},
				},
			},
			want: "FlexVolume",
		},
		{
			name: "PhotonPersistentDisk",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					PhotonPersistentDisk: &corev1.PhotonPersistentDiskVolumeSource{PdID: "photon-1"},
				},
			},
			want: "PhotonPersistentDisk",
		},
		{
			name: "ScaleIO",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					ScaleIO: &corev1.ScaleIOPersistentVolumeSource{Gateway: "gw"},
				},
			},
			want: "ScaleIO",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := getPVVolumeType(&tc.spec)
			if got != tc.want {
				t.Errorf("getPVVolumeType() = %q, want %q", got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestWriteHPAMetrics – pure function from holmes_context.go
// ---------------------------------------------------------------------------

func TestWriteHPAMetrics(t *testing.T) {
t.Run("empty metrics does nothing", func(t *testing.T) {
var sb strings.Builder
writeHPAMetrics(&sb, nil)
if sb.Len() != 0 {
t.Errorf("expected empty output, got: %q", sb.String())
}
})

t.Run("metric with non-resource type is skipped", func(t *testing.T) {
var sb strings.Builder
metrics := []autoscalingv2.MetricSpec{
{Type: autoscalingv2.ExternalMetricSourceType},
}
writeHPAMetrics(&sb, metrics)
// Header should still be printed but no resource entries
out := sb.String()
if strings.Contains(out, "target:") {
t.Errorf("should not have resource target: %s", out)
}
})

t.Run("nil resource in metric is skipped", func(t *testing.T) {
var sb strings.Builder
metrics := []autoscalingv2.MetricSpec{
{Type: autoscalingv2.ResourceMetricSourceType, Resource: nil},
}
writeHPAMetrics(&sb, metrics)
out := sb.String()
if strings.Contains(out, "target:") {
t.Errorf("should not have resource target: %s", out)
}
})

t.Run("resource metric is written", func(t *testing.T) {
var sb strings.Builder
util := int32(80)
metrics := []autoscalingv2.MetricSpec{
{
Type: autoscalingv2.ResourceMetricSourceType,
Resource: &autoscalingv2.ResourceMetricSource{
Name: corev1.ResourceCPU,
Target: autoscalingv2.MetricTarget{
Type:               autoscalingv2.UtilizationMetricType,
AverageUtilization: &util,
},
},
},
}
writeHPAMetrics(&sb, metrics)
out := sb.String()
if !strings.Contains(out, "cpu") {
t.Errorf("expected cpu in output: %s", out)
}
if !strings.Contains(out, "80%") {
t.Errorf("expected 80%% in output: %s", out)
}
})
}

// ---------------------------------------------------------------------------
// TestWriteHPACurrentMetrics – pure function from holmes_context.go
// ---------------------------------------------------------------------------

func TestWriteHPACurrentMetrics(t *testing.T) {
t.Run("empty metrics does nothing", func(t *testing.T) {
var sb strings.Builder
writeHPACurrentMetrics(&sb, nil)
if sb.Len() != 0 {
t.Errorf("expected empty output, got: %q", sb.String())
}
})

t.Run("non-resource type is skipped", func(t *testing.T) {
var sb strings.Builder
metrics := []autoscalingv2.MetricStatus{
{Type: autoscalingv2.ExternalMetricSourceType},
}
writeHPACurrentMetrics(&sb, metrics)
out := sb.String()
if strings.Contains(out, "current:") {
t.Errorf("should not have current entry: %s", out)
}
})

t.Run("resource metric is written", func(t *testing.T) {
util := int32(65)
var sb strings.Builder
metrics := []autoscalingv2.MetricStatus{
{
Type: autoscalingv2.ResourceMetricSourceType,
Resource: &autoscalingv2.ResourceMetricStatus{
Name:    corev1.ResourceCPU,
Current: autoscalingv2.MetricValueStatus{AverageUtilization: &util},
},
},
}
writeHPACurrentMetrics(&sb, metrics)
out := sb.String()
if !strings.Contains(out, "current:") {
t.Errorf("expected current: in output: %s", out)
}
if !strings.Contains(out, "65%") {
t.Errorf("expected 65%% in output: %s", out)
}
})
}
