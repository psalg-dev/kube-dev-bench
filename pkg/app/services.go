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

// ServiceEndpoint represents a single endpoint address for a service
type ServiceEndpoint struct {
	IP       string `json:"ip"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
	PodName  string `json:"podName"`
	NodeName string `json:"nodeName"`
	Ready    bool   `json:"ready"`
}

// GetServiceEndpoints returns the endpoints for a service
func (a *App) GetServiceEndpoints(namespace, serviceName string) ([]ServiceEndpoint, error) {
	if namespace == "" || serviceName == "" {
		return nil, fmt.Errorf("namespace and service name are required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	// Get the service to know the port mappings
	svc, err := clientset.CoreV1().Services(namespace).Get(a.ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get service: %w", err)
	}

	// Get the endpoints for this service
	endpoints, err := clientset.CoreV1().Endpoints(namespace).Get(a.ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get endpoints: %w", err)
	}

	var result []ServiceEndpoint

	// Build a map of port numbers to protocols from the service spec
	portProtocols := make(map[int32]string)
	for _, port := range svc.Spec.Ports {
		portProtocols[port.Port] = string(port.Protocol)
	}

	for _, subset := range endpoints.Subsets {
		// Process ready addresses
		for _, addr := range subset.Addresses {
			for _, port := range subset.Ports {
				protocol := portProtocols[port.Port]
				if protocol == "" {
					protocol = string(port.Protocol)
				}
				ep := ServiceEndpoint{
					IP:       addr.IP,
					Port:     port.Port,
					Protocol: protocol,
					Ready:    true,
				}
				if addr.TargetRef != nil && addr.TargetRef.Kind == "Pod" {
					ep.PodName = addr.TargetRef.Name
				}
				if addr.NodeName != nil {
					ep.NodeName = *addr.NodeName
				}
				result = append(result, ep)
			}
		}

		// Process not-ready addresses
		for _, addr := range subset.NotReadyAddresses {
			for _, port := range subset.Ports {
				protocol := portProtocols[port.Port]
				if protocol == "" {
					protocol = string(port.Protocol)
				}
				ep := ServiceEndpoint{
					IP:       addr.IP,
					Port:     port.Port,
					Protocol: protocol,
					Ready:    false,
				}
				if addr.TargetRef != nil && addr.TargetRef.Kind == "Pod" {
					ep.PodName = addr.TargetRef.Name
				}
				if addr.NodeName != nil {
					ep.NodeName = *addr.NodeName
				}
				result = append(result, ep)
			}
		}
	}

	return result, nil
}
