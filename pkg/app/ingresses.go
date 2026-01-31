package app

import (
	"strings"
	"time"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// getIngressClass extracts the ingress class from spec or annotations
func getIngressClass(ingress *networkingv1.Ingress) string {
	if ingress.Spec.IngressClassName != nil {
		return *ingress.Spec.IngressClassName
	}
	if classAnnotation, exists := ingress.Annotations["kubernetes.io/ingress.class"]; exists {
		return classAnnotation
	}
	return ""
}

// collectIngressHosts extracts all hosts from ingress rules
func collectIngressHosts(ingress *networkingv1.Ingress) []string {
	var hosts []string
	for _, rule := range ingress.Spec.Rules {
		if rule.Host != "" {
			hosts = append(hosts, rule.Host)
		}
	}
	return hosts
}

// getIngressAddress extracts load balancer addresses
func getIngressAddress(ingress *networkingv1.Ingress) string {
	var addresses []string
	for _, lbIngress := range ingress.Status.LoadBalancer.Ingress {
		if lbIngress.IP != "" {
			addresses = append(addresses, lbIngress.IP)
		}
		if lbIngress.Hostname != "" {
			addresses = append(addresses, lbIngress.Hostname)
		}
	}
	if len(addresses) == 0 {
		return "-"
	}
	return strings.Join(addresses, ",")
}

// buildIngressInfo creates an IngressInfo from an ingress resource
func buildIngressInfo(ingress networkingv1.Ingress, now time.Time) IngressInfo {
	age := "-"
	if ingress.CreationTimestamp.Time != (time.Time{}) {
		age = formatDuration(now.Sub(ingress.CreationTimestamp.Time))
	}

	ports := "80"
	if len(ingress.Spec.TLS) > 0 {
		ports = "80,443"
	}

	return IngressInfo{
		Name:      ingress.Name,
		Namespace: ingress.Namespace,
		Class:     getIngressClass(&ingress),
		Hosts:     collectIngressHosts(&ingress),
		Address:   getIngressAddress(&ingress),
		Ports:     ports,
		Age:       age,
		Labels:    ingress.Labels,
	}
}

// GetIngresses returns all ingresses in a namespace
func (a *App) GetIngresses(namespace string) ([]IngressInfo, error) {
	clientset, err := a.getClient()
	if err != nil {
		return nil, err
	}

	ingresses, err := clientset.NetworkingV1().Ingresses(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]IngressInfo, 0, len(ingresses.Items))
	for _, ingress := range ingresses.Items {
		result = append(result, buildIngressInfo(ingress, now))
	}

	return result, nil
}
