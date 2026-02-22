package app

import (
	"context"
	"testing"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetHorizontalPodAutoscalerDetail_ReturnsInfo(t *testing.T) {
	ctx := context.Background()
	minReplicas := int32(2)
	targetCPU := int32(70)
	currentCPU := int32(55)

	clientset := fake.NewSimpleClientset(
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "web-hpa", Namespace: "default"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "web"},
				MinReplicas:    &minReplicas,
				MaxReplicas:    8,
				Metrics: []autoscalingv2.MetricSpec{{
					Type: autoscalingv2.ResourceMetricSourceType,
					Resource: &autoscalingv2.ResourceMetricSource{
						Name: corev1.ResourceCPU,
						Target: autoscalingv2.MetricTarget{
							Type:               autoscalingv2.UtilizationMetricType,
							AverageUtilization: &targetCPU,
						},
					},
				}},
			},
			Status: autoscalingv2.HorizontalPodAutoscalerStatus{
				CurrentReplicas: 3,
				DesiredReplicas: 4,
				CurrentMetrics: []autoscalingv2.MetricStatus{{
					Type: autoscalingv2.ResourceMetricSourceType,
					Resource: &autoscalingv2.ResourceMetricStatus{
						Name: corev1.ResourceCPU,
						Current: autoscalingv2.MetricValueStatus{
							AverageUtilization: &currentCPU,
						},
					},
				}},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	info, err := app.GetHorizontalPodAutoscalerDetail("default", "web-hpa")
	if err != nil {
		t.Fatalf("GetHorizontalPodAutoscalerDetail failed: %v", err)
	}

	if info.Name != "web-hpa" {
		t.Fatalf("expected web-hpa, got %s", info.Name)
	}
	if info.TargetName != "web" {
		t.Fatalf("expected target web, got %s", info.TargetName)
	}
	if info.TargetCPU != "70%" {
		t.Fatalf("expected target CPU 70%%, got %s", info.TargetCPU)
	}
	if info.CurrentCPU != "55%" {
		t.Fatalf("expected current CPU 55%%, got %s", info.CurrentCPU)
	}
}

func TestGetHorizontalPodAutoscalerDetail_Validation(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}

	if _, err := app.GetHorizontalPodAutoscalerDetail("", "name"); err == nil {
		t.Fatal("expected namespace validation error")
	}
	if _, err := app.GetHorizontalPodAutoscalerDetail("default", ""); err == nil {
		t.Fatal("expected name validation error")
	}
}
