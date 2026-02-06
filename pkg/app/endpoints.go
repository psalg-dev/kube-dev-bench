package app

import (
	"fmt"
	"strings"
	"time"

	discoveryv1 "k8s.io/api/discovery/v1"
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

	slices, err := clientset.DiscoveryV1().EndpointSlices(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	groups := make(map[string][]discoveryv1.EndpointSlice)
	for _, slice := range slices.Items {
		serviceName := strings.TrimSpace(slice.Labels[discoveryv1.LabelServiceName])
		if serviceName == "" {
			serviceName = slice.Name
		}
		groups[serviceName] = append(groups[serviceName], slice)
	}

	now := time.Now()
	result := make([]EndpointInfo, 0, len(groups))
	for name, groupedSlices := range groups {
		info := buildEndpointInfoFromSlices(namespace, name, groupedSlices, now)
		result = append(result, info)
	}

	return result, nil
}

// buildEndpointInfoFromSlices constructs an EndpointInfo from EndpointSlice objects.
func buildEndpointInfoFromSlices(namespace, name string, slices []discoveryv1.EndpointSlice, now time.Time) EndpointInfo {
	info := EndpointInfo{
		Name:      name,
		Namespace: namespace,
		Age:       "-",
		Endpoints: []string{},
		Raw:       slices,
	}
	if len(slices) == 0 {
		return info
	}

	oldest := slices[0].CreationTimestamp.Time
	info.Labels = slices[0].Labels
	info.Annotations = slices[0].Annotations

	for _, slice := range slices {
		if !slice.CreationTimestamp.Time.IsZero() && slice.CreationTimestamp.Time.Before(oldest) {
			oldest = slice.CreationTimestamp.Time
		}
		info.Endpoints = append(info.Endpoints, extractSliceAddresses(&slice)...)
	}

	if !oldest.IsZero() {
		info.Age = formatDuration(now.Sub(oldest))
	}

	return info
}

func extractSliceAddresses(slice *discoveryv1.EndpointSlice) []string {
	if slice == nil {
		return nil
	}

	ports := slice.Ports
	addresses := make([]string, 0)
	for _, endpoint := range slice.Endpoints {
		for _, addr := range endpoint.Addresses {
			if len(ports) == 0 {
				addresses = append(addresses, addr)
				continue
			}
			for _, port := range ports {
				if port.Port == nil {
					addresses = append(addresses, addr)
					continue
				}
				addresses = append(addresses, fmt.Sprintf("%s:%d", addr, *port.Port))
			}
		}
	}

	return addresses
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

	selector := fmt.Sprintf("%s=%s", discoveryv1.LabelServiceName, name)
	sliceList, err := clientset.DiscoveryV1().EndpointSlices(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		return nil, err
	}
	if len(sliceList.Items) == 0 {
		return nil, fmt.Errorf("endpoint not found: %s", name)
	}

	info := buildEndpointInfoFromSlices(namespace, name, sliceList.Items, time.Now())
	return &info, nil
}
