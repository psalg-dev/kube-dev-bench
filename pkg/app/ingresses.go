package app

import (
	"fmt"
	"strings"
	"time"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
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
	var clientset kubernetes.Interface
	var err error

	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		configPath := a.getKubeConfigPath()
		config, err := clientcmd.LoadFromFile(configPath)
		if err != nil {
			return nil, err
		}
		if a.currentKubeContext == "" {
			return nil, fmt.Errorf("Kein Kontext gewählt")
		}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			return nil, err
		}
		clientset, err = kubernetes.NewForConfig(restConfig)
		if err != nil {
			return nil, err
		}
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

// StartIngressPolling emits ingresses:update events periodically with the current ingress list
func (a *App) StartIngressPolling() {
	startResourcePolling(a, ResourcePollingConfig[IngressInfo]{
		EventName: "ingresses:update",
		FetchFn:   a.GetIngresses,
	})
}
