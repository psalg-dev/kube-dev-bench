package app

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetServices returns all services in a namespace.
func (a *App) GetServices(namespace string) ([]ServiceInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	services, err := clientset.CoreV1().Services(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]ServiceInfo, 0, len(services.Items))

	for _, svc := range services.Items {
		age := "-"
		if svc.CreationTimestamp.Time != (time.Time{}) {
			age = formatDuration(now.Sub(svc.CreationTimestamp.Time))
		}

		ports := make([]string, 0, len(svc.Spec.Ports))
		for _, port := range svc.Spec.Ports {
			label := fmt.Sprintf("%d/%s", port.Port, port.Protocol)
			if port.Name != "" {
				label = fmt.Sprintf("%s (%s)", label, port.Name)
			}
			ports = append(ports, label)
		}

		result = append(result, ServiceInfo{
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Type:      string(svc.Spec.Type),
			ClusterIP: svc.Spec.ClusterIP,
			Ports:     strings.Join(ports, ", "),
			Age:       age,
			Labels:    svc.Labels,
		})
	}

	return result, nil
}
