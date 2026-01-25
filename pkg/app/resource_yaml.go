package app

import (
	"context"
	"fmt"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetServiceYAML retrieves the YAML manifest for a Service
func (a *App) GetServiceYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	svc, err := clientset.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get service: %w", err)
	}
	// Clear managed fields for cleaner output
	svc.ManagedFields = nil
	data, err := yaml.Marshal(svc)
	if err != nil {
		return "", fmt.Errorf("failed to marshal service: %w", err)
	}
	return string(data), nil
}

// GetIngressYAML retrieves the YAML manifest for an Ingress
func (a *App) GetIngressYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	ing, err := clientset.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get ingress: %w", err)
	}
	ing.ManagedFields = nil
	data, err := yaml.Marshal(ing)
	if err != nil {
		return "", fmt.Errorf("failed to marshal ingress: %w", err)
	}
	return string(data), nil
}

// GetJobYAML retrieves the YAML manifest for a Job
func (a *App) GetJobYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	job, err := clientset.BatchV1().Jobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get job: %w", err)
	}
	job.ManagedFields = nil
	data, err := yaml.Marshal(job)
	if err != nil {
		return "", fmt.Errorf("failed to marshal job: %w", err)
	}
	return string(data), nil
}

// GetCronJobYAML retrieves the YAML manifest for a CronJob
func (a *App) GetCronJobYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	cronJob, err := clientset.BatchV1().CronJobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get cronjob: %w", err)
	}
	cronJob.ManagedFields = nil
	data, err := yaml.Marshal(cronJob)
	if err != nil {
		return "", fmt.Errorf("failed to marshal cronjob: %w", err)
	}
	return string(data), nil
}

// GetConfigMapYAML retrieves the YAML manifest for a ConfigMap
func (a *App) GetConfigMapYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	cm, err := clientset.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get configmap: %w", err)
	}
	cm.ManagedFields = nil
	data, err := yaml.Marshal(cm)
	if err != nil {
		return "", fmt.Errorf("failed to marshal configmap: %w", err)
	}
	return string(data), nil
}

// GetSecretYAML retrieves the YAML manifest for a Secret
// Note: Secret data values are shown as-is (base64 encoded) from the API
func (a *App) GetSecretYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	secret, err := clientset.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get secret: %w", err)
	}
	secret.ManagedFields = nil
	data, err := yaml.Marshal(secret)
	if err != nil {
		return "", fmt.Errorf("failed to marshal secret: %w", err)
	}
	return string(data), nil
}

// GetPersistentVolumeYAML retrieves the YAML manifest for a PV (cluster-scoped)
func (a *App) GetPersistentVolumeYAML(name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	pv, err := clientset.CoreV1().PersistentVolumes().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get persistent volume: %w", err)
	}
	pv.ManagedFields = nil
	data, err := yaml.Marshal(pv)
	if err != nil {
		return "", fmt.Errorf("failed to marshal persistent volume: %w", err)
	}
	return string(data), nil
}

// GetPersistentVolumeClaimYAML retrieves the YAML manifest for a PVC
func (a *App) GetPersistentVolumeClaimYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get persistent volume claim: %w", err)
	}
	pvc.ManagedFields = nil
	data, err := yaml.Marshal(pvc)
	if err != nil {
		return "", fmt.Errorf("failed to marshal persistent volume claim: %w", err)
	}
	return string(data), nil
}
