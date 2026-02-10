package app

import (
	"strings"
	"time"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
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
func buildIngressInfo(ingress *networkingv1.Ingress, now time.Time) IngressInfo {
	ports := "80"
	if len(ingress.Spec.TLS) > 0 {
		ports = "80,443"
	}

	return IngressInfo{
		Name:      ingress.Name,
		Namespace: ingress.Namespace,
		Class:     getIngressClass(ingress),
		Hosts:     collectIngressHosts(ingress),
		Address:   getIngressAddress(ingress),
		Ports:     ports,
		Age:       FormatAge(ingress.CreationTimestamp, now),
		Labels:    ingress.Labels,
	}
}

// GetIngresses returns all ingresses in a namespace
func (a *App) GetIngresses(namespace string) ([]IngressInfo, error) {
	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]networkingv1.Ingress, error) {
			list, err := cs.NetworkingV1().Ingresses(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildIngressInfo,
	)
}
