package app

import (
	"fmt"
	"strings"
	"time"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func formatHPAMetricTarget(target autoscalingv2.MetricTarget) string {
	switch target.Type {
	case autoscalingv2.UtilizationMetricType:
		if target.AverageUtilization == nil {
			return ""
		}
		return fmt.Sprintf("%d%%", *target.AverageUtilization)
	case autoscalingv2.AverageValueMetricType:
		if target.AverageValue == nil {
			return ""
		}
		return target.AverageValue.String()
	case autoscalingv2.ValueMetricType:
		if target.Value == nil {
			return ""
		}
		return target.Value.String()
	default:
		return ""
	}
}

func formatHPAMetricStatus(status autoscalingv2.MetricValueStatus) string {
	if status.AverageUtilization != nil {
		return fmt.Sprintf("%d%%", *status.AverageUtilization)
	}
	if status.AverageValue != nil {
		return status.AverageValue.String()
	}
	if status.Value != nil {
		return status.Value.String()
	}
	return ""
}

func buildHPAInfo(hpa *autoscalingv2.HorizontalPodAutoscaler, now time.Time) HorizontalPodAutoscalerInfo {
	minReplicas := int32(1)
	if hpa.Spec.MinReplicas != nil {
		minReplicas = *hpa.Spec.MinReplicas
	}

	info := HorizontalPodAutoscalerInfo{
		Name:            hpa.Name,
		Namespace:       hpa.Namespace,
		TargetKind:      hpa.Spec.ScaleTargetRef.Kind,
		TargetName:      hpa.Spec.ScaleTargetRef.Name,
		MinReplicas:     minReplicas,
		MaxReplicas:     hpa.Spec.MaxReplicas,
		CurrentReplicas: hpa.Status.CurrentReplicas,
		DesiredReplicas: hpa.Status.DesiredReplicas,
		Age:             FormatAge(hpa.CreationTimestamp, now),
	}

	for _, metric := range hpa.Spec.Metrics {
		if metric.Type != autoscalingv2.ResourceMetricSourceType || metric.Resource == nil {
			continue
		}
		resourceName := strings.ToLower(string(metric.Resource.Name))
		target := formatHPAMetricTarget(metric.Resource.Target)
		if resourceName == string(corev1.ResourceCPU) {
			info.TargetCPU = target
		}
		if resourceName == string(corev1.ResourceMemory) {
			info.TargetMemory = target
		}
	}

	for _, metric := range hpa.Status.CurrentMetrics {
		if metric.Type != autoscalingv2.ResourceMetricSourceType || metric.Resource == nil {
			continue
		}
		resourceName := strings.ToLower(string(metric.Resource.Name))
		current := formatHPAMetricStatus(metric.Resource.Current)
		if resourceName == string(corev1.ResourceCPU) {
			info.CurrentCPU = current
		}
		if resourceName == string(corev1.ResourceMemory) {
			info.CurrentMemory = current
		}
	}

	return info
}

// GetHorizontalPodAutoscalers returns all HPAs in a namespace.
func (a *App) GetHorizontalPodAutoscalers(namespace string) ([]HorizontalPodAutoscalerInfo, error) {
	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]autoscalingv2.HorizontalPodAutoscaler, error) {
			list, err := cs.AutoscalingV2().HorizontalPodAutoscalers(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildHPAInfo,
	)
}

// GetHorizontalPodAutoscalerDetail returns details for a specific HPA.
func (a *App) GetHorizontalPodAutoscalerDetail(namespace, name string) (*HorizontalPodAutoscalerInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	hpa, err := clientset.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildHPAInfo(hpa, time.Now())
	return &info, nil
}
