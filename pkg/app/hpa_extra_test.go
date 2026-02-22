package app

import (
	"time"
	"context"
	"testing"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ---------------------------------------------------------------------------
// TestGetHorizontalPodAutoscalers
// ---------------------------------------------------------------------------

func TestGetHorizontalPodAutoscalers_HappyPath(t *testing.T) {
	util := int32(80)
	minR := int32(2)
	hpa := &autoscalingv2.HorizontalPodAutoscaler{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-hpa",
			Namespace: "default",
		},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				Kind: "Deployment",
				Name: "my-deploy",
			},
			MinReplicas: &minR,
			MaxReplicas: 10,
			Metrics: []autoscalingv2.MetricSpec{
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
			},
		},
	}
	cs := fake.NewSimpleClientset(hpa)
	app := &App{ctx: context.Background(), testClientset: cs}
	prev := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = prev })

	results, err := app.GetHorizontalPodAutoscalers("default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 HPA, got %d", len(results))
	}
	got := results[0]
	if got.Name != "my-hpa" {
		t.Errorf("Name=%q, want my-hpa", got.Name)
	}
	if got.TargetCPU != "80%" {
		t.Errorf("TargetCPU=%q, want 80%%", got.TargetCPU)
	}
	if got.MinReplicas != 2 {
		t.Errorf("MinReplicas=%d, want 2", got.MinReplicas)
	}
	if got.MaxReplicas != 10 {
		t.Errorf("MaxReplicas=%d, want 10", got.MaxReplicas)
	}
}

func TestGetHorizontalPodAutoscalers_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	prev := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = prev })

	_, err := app.GetHorizontalPodAutoscalers("")
	if err != nil {
		t.Fatalf("empty namespace should succeed (lists all), got: %v", err)
	}
}

func TestGetHorizontalPodAutoscalers_Empty(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	prev := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = prev })

	results, err := app.GetHorizontalPodAutoscalers("default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected empty list, got %d items", len(results))
	}
}

// ---------------------------------------------------------------------------
// TestGetHorizontalPodAutoscalerDetail
// ---------------------------------------------------------------------------

func TestGetHorizontalPodAutoscalerDetail_HappyPath(t *testing.T) {
	memTarget := resource.MustParse("500Mi")
	hpa := &autoscalingv2.HorizontalPodAutoscaler{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "memory-hpa",
			Namespace: "prod",
		},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				Kind: "StatefulSet",
				Name: "my-statefulset",
			},
			MaxReplicas: 5,
			Metrics: []autoscalingv2.MetricSpec{
				{
					Type: autoscalingv2.ResourceMetricSourceType,
					Resource: &autoscalingv2.ResourceMetricSource{
						Name: corev1.ResourceMemory,
						Target: autoscalingv2.MetricTarget{
							Type:         autoscalingv2.AverageValueMetricType,
							AverageValue: &memTarget,
						},
					},
				},
			},
		},
	}
	cs := fake.NewSimpleClientset(hpa)
	app := &App{ctx: context.Background(), testClientset: cs}
	prev := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = prev })

	detail, err := app.GetHorizontalPodAutoscalerDetail("prod", "memory-hpa")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detail.TargetKind != "StatefulSet" {
		t.Errorf("TargetKind=%q, want StatefulSet", detail.TargetKind)
	}
	if detail.TargetMemory == "" {
		t.Errorf("TargetMemory should not be empty")
	}
}

func TestGetHorizontalPodAutoscalerDetail_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetHorizontalPodAutoscalerDetail("", "my-hpa")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetHorizontalPodAutoscalerDetail_EmptyName(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetHorizontalPodAutoscalerDetail("default", "")
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestGetHorizontalPodAutoscalerDetail_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetHorizontalPodAutoscalerDetail("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing HPA")
	}
}

// ---------------------------------------------------------------------------
// TestGetUseInformers / TestSetUseInformers (config.go trivial)
// ---------------------------------------------------------------------------

func TestGetUseInformers(t *testing.T) {
	app := &App{}
	if app.GetUseInformers() != false {
		t.Error("new App should have useInformers=false")
	}
	app.useInformers = true
	if !app.GetUseInformers() {
		t.Error("expected useInformers=true")
	}
}

// ---------------------------------------------------------------------------
// TestKindClusterHelpers (kind_cluster.go mutex helpers)
// ---------------------------------------------------------------------------

func TestKindClusterHelpers(t *testing.T) {
	app := &App{}

	t.Run("setKindCmd and clearKindCmd", func(t *testing.T) {
		if app.kindCmd != nil {
			t.Error("expected nil initial kindCmd")
		}
		app.setKindCmd(nil)
		app.clearKindCmd(nil)
	})

	t.Run("setKindPullCmd and clearKindPullCmd", func(t *testing.T) {
		if app.kindPullCmd != nil {
			t.Error("expected nil initial kindPullCmd")
		}
		app.setKindPullCmd(nil)
		app.clearKindPullCmd(nil)
	})

	t.Run("isKindCanceled returns false when no cancel set", func(t *testing.T) {
		if app.isKindCanceled(context.Background()) {
			t.Error("expected false when no cancel")
		}
	})
}

// ---------------------------------------------------------------------------
// TestFormatHPAMetricTarget
// ---------------------------------------------------------------------------

func TestFormatHPAMetricTarget(t *testing.T) {
	t.Run("utilization type", func(t *testing.T) {
		util := int32(75)
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type:               autoscalingv2.UtilizationMetricType,
			AverageUtilization: &util,
		})
		if got != "75%" {
			t.Errorf("expected 75%%, got %q", got)
		}
	})

	t.Run("utilization type nil pointer", func(t *testing.T) {
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type:               autoscalingv2.UtilizationMetricType,
			AverageUtilization: nil,
		})
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})

	t.Run("average value type", func(t *testing.T) {
		val := resource.MustParse("100m")
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type:         autoscalingv2.AverageValueMetricType,
			AverageValue: &val,
		})
		if got == "" {
			t.Error("expected non-empty average value")
		}
	})

	t.Run("average value type nil pointer", func(t *testing.T) {
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type:         autoscalingv2.AverageValueMetricType,
			AverageValue: nil,
		})
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})

	t.Run("value type", func(t *testing.T) {
		val := resource.MustParse("1Gi")
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type:  autoscalingv2.ValueMetricType,
			Value: &val,
		})
		if got == "" {
			t.Error("expected non-empty value")
		}
	})

	t.Run("value type nil pointer", func(t *testing.T) {
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type:  autoscalingv2.ValueMetricType,
			Value: nil,
		})
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})

	t.Run("unknown type returns empty", func(t *testing.T) {
		got := formatHPAMetricTarget(autoscalingv2.MetricTarget{
			Type: "Unknown",
		})
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})
}

// ---------------------------------------------------------------------------
// TestBuildHPAInfo_AllBranches – covers non-resource metric and memory paths
// ---------------------------------------------------------------------------

func TestBuildHPAInfo_AllBranches(t *testing.T) {
import_ctx := context.Background()
_ = import_ctx

t.Run("non-resource spec metric is skipped", func(t *testing.T) {
minR := int32(1)
hpa := &autoscalingv2.HorizontalPodAutoscaler{
ObjectMeta: metav1.ObjectMeta{Name: "test-hpa", Namespace: "default"},
Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "d"},
MinReplicas:    &minR,
MaxReplicas:    5,
Metrics: []autoscalingv2.MetricSpec{
{Type: autoscalingv2.ExternalMetricSourceType}, // non-resource, should skip
},
},
}
info := buildHPAInfo(hpa, time.Now())
if info.TargetCPU != "" || info.TargetMemory != "" {
t.Errorf("expected empty targets for non-resource metric, got CPU=%q Memory=%q", info.TargetCPU, info.TargetMemory)
}
})

t.Run("memory current metric is included", func(t *testing.T) {
memCurrent := resource.MustParse("256Mi")
hpa := &autoscalingv2.HorizontalPodAutoscaler{
ObjectMeta: metav1.ObjectMeta{Name: "mem-hpa", Namespace: "default"},
Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "d"},
MaxReplicas:    3,
},
Status: autoscalingv2.HorizontalPodAutoscalerStatus{
CurrentMetrics: []autoscalingv2.MetricStatus{
{
Type: autoscalingv2.ResourceMetricSourceType,
Resource: &autoscalingv2.ResourceMetricStatus{
Name:    corev1.ResourceMemory,
Current: autoscalingv2.MetricValueStatus{AverageValue: &memCurrent},
},
},
},
},
}
info := buildHPAInfo(hpa, time.Now())
if info.CurrentMemory == "" {
t.Error("expected CurrentMemory to be set")
}
})

t.Run("non-resource current metric is skipped", func(t *testing.T) {
hpa := &autoscalingv2.HorizontalPodAutoscaler{
ObjectMeta: metav1.ObjectMeta{Name: "ext-hpa", Namespace: "default"},
Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "d"},
MaxReplicas:    3,
},
Status: autoscalingv2.HorizontalPodAutoscalerStatus{
CurrentMetrics: []autoscalingv2.MetricStatus{
{Type: autoscalingv2.ExternalMetricSourceType}, // non-resource, should skip
},
},
}
info := buildHPAInfo(hpa, time.Now())
if info.CurrentMemory != "" || info.CurrentCPU != "" {
t.Errorf("expected empty current metrics for non-resource type")
}
})

t.Run("memory spec target is included", func(t *testing.T) {
minR := int32(1)
memTarget := int32(70)
hpa := &autoscalingv2.HorizontalPodAutoscaler{
ObjectMeta: metav1.ObjectMeta{Name: "mem-target-hpa", Namespace: "default"},
Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "d"},
MinReplicas:    &minR,
MaxReplicas:    5,
Metrics: []autoscalingv2.MetricSpec{
{
Type: autoscalingv2.ResourceMetricSourceType,
Resource: &autoscalingv2.ResourceMetricSource{
Name: corev1.ResourceMemory,
Target: autoscalingv2.MetricTarget{
Type:               autoscalingv2.UtilizationMetricType,
AverageUtilization: &memTarget,
},
},
},
},
},
}
info := buildHPAInfo(hpa, time.Now())
if info.TargetMemory == "" {
t.Error("expected TargetMemory to be set")
}
})
}
