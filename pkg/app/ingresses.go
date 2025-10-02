package app

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetIngresses returns all ingresses in a namespace
func (a *App) GetIngresses(namespace string) ([]IngressInfo, error) {
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
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}

	ingresses, err := clientset.NetworkingV1().Ingresses(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []IngressInfo
	now := time.Now()

	for _, ingress := range ingresses.Items {
		age := "-"
		if ingress.CreationTimestamp.Time != (time.Time{}) {
			dur := now.Sub(ingress.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		// Get ingress class
		ingressClass := ""
		if ingress.Spec.IngressClassName != nil {
			ingressClass = *ingress.Spec.IngressClassName
		} else if classAnnotation, exists := ingress.Annotations["kubernetes.io/ingress.class"]; exists {
			ingressClass = classAnnotation
		}

		// Collect hosts
		var hosts []string
		for _, rule := range ingress.Spec.Rules {
			if rule.Host != "" {
				hosts = append(hosts, rule.Host)
			}
		}

		// Get load balancer addresses
		var addresses []string
		for _, lbIngress := range ingress.Status.LoadBalancer.Ingress {
			if lbIngress.IP != "" {
				addresses = append(addresses, lbIngress.IP)
			}
			if lbIngress.Hostname != "" {
				addresses = append(addresses, lbIngress.Hostname)
			}
		}
		address := strings.Join(addresses, ",")
		if address == "" {
			address = "-"
		}

		// Determine ports from rules
		ports := "80"
		hasTLS := len(ingress.Spec.TLS) > 0
		if hasTLS {
			ports = "80,443"
		}

		result = append(result, IngressInfo{
			Name:      ingress.Name,
			Namespace: ingress.Namespace,
			Class:     ingressClass,
			Hosts:     hosts,
			Address:   address,
			Ports:     ports,
			Age:       age,
		})
	}

	return result, nil
}
