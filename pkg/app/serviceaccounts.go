package app

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ServiceAccountInfo represents summary information about a Kubernetes service account
type ServiceAccountInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Age         string            `json:"age"`
	Secrets     []string          `json:"secrets"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Raw         interface{}       `json:"raw,omitempty"`
}

// GetServiceAccounts returns all service accounts in the specified namespace
func (a *App) GetServiceAccounts(namespace string) ([]ServiceAccountInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing required parameter: namespace")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	serviceAccounts, err := clientset.CoreV1().ServiceAccounts(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]ServiceAccountInfo, 0, len(serviceAccounts.Items))

	for _, sa := range serviceAccounts.Items {
		info := buildServiceAccountInfo(&sa, now)
		result = append(result, info)
	}

	return result, nil
}

// buildServiceAccountInfo constructs a ServiceAccountInfo from a ServiceAccount
func buildServiceAccountInfo(sa *corev1.ServiceAccount, now time.Time) ServiceAccountInfo {
	age := "-"
	if !sa.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(sa.CreationTimestamp.Time))
	}

	// Extract secret names
	secrets := make([]string, 0, len(sa.Secrets))
	for _, secret := range sa.Secrets {
		secrets = append(secrets, secret.Name)
	}

	return ServiceAccountInfo{
		Name:        sa.Name,
		Namespace:   sa.Namespace,
		Age:         age,
		Secrets:     secrets,
		Labels:      sa.Labels,
		Annotations: sa.Annotations,
		Raw:         sa,
	}
}

// GetServiceAccountDetail returns detailed information about a specific service account
func (a *App) GetServiceAccountDetail(namespace, name string) (*ServiceAccountInfo, error) {
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

	sa, err := clientset.CoreV1().ServiceAccounts(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildServiceAccountInfo(sa, time.Now())
	return &info, nil
}
