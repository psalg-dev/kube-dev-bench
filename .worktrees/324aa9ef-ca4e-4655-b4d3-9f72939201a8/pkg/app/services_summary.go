package app

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ServiceSummary struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Type      string `json:"type"`
	ClusterIP string `json:"clusterIP"`
}

// GetServiceSummary returns basic info about a Service.
func (a *App) GetServiceSummary(namespace, serviceName string) (*ServiceSummary, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	if serviceName == "" {
		return nil, fmt.Errorf("service name is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	svc, err := clientset.CoreV1().Services(namespace).Get(a.ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	return &ServiceSummary{
		Name:      svc.Name,
		Namespace: svc.Namespace,
		Type:      string(svc.Spec.Type),
		ClusterIP: svc.Spec.ClusterIP,
	}, nil
}
