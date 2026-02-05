package app

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EndpointInfo represents summary information about a Kubernetes endpoint
type EndpointInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Age         string            `json:"age"`
	Endpoints   []string          `json:"endpoints"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Raw         interface{}       `json:"raw,omitempty"`
}

// GetEndpoints returns all endpoints in the specified namespace
func (a *App) GetEndpoints(namespace string) ([]EndpointInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	endpoints, err := clientset.CoreV1().Endpoints(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]EndpointInfo, 0, len(endpoints.Items))

	for _, endpoint := range endpoints.Items {
		info := buildEndpointInfo(&endpoint, now)
		result = append(result, info)
	}

	return result, nil
}

// buildEndpointInfo constructs an EndpointInfo from an Endpoints
func buildEndpointInfo(endpoint *corev1.Endpoints, now time.Time) EndpointInfo {
	age := "-"
	if !endpoint.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(endpoint.CreationTimestamp.Time))
	}

	// Extract endpoint addresses
	addresses := []string{}
	for _, subset := range endpoint.Subsets {
		for _, addr := range subset.Addresses {
			for _, port := range subset.Ports {
				addresses = append(addresses, fmt.Sprintf("%s:%d", addr.IP, port.Port))
			}
		}
	}

	return EndpointInfo{
		Name:        endpoint.Name,
		Namespace:   endpoint.Namespace,
		Age:         age,
		Endpoints:   addresses,
		Labels:      endpoint.Labels,
		Annotations: endpoint.Annotations,
		Raw:         endpoint,
	}
}

// GetEndpointDetail returns detailed information about a specific endpoint
func (a *App) GetEndpointDetail(namespace, name string) (*EndpointInfo, error) {
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

	endpoint, err := clientset.CoreV1().Endpoints(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildEndpointInfo(endpoint, time.Now())
	return &info, nil
}
