package app

import (
	"context"
	"fmt"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func (a *App) getResourceYAML(namespace, name string, requireNamespace bool, resourceName string, getter func(kubernetes.Interface) (metav1.Object, error)) (string, error) {
	if requireNamespace && namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	resource, err := getter(clientset)
	if err != nil {
		return "", fmt.Errorf("failed to get %s: %w", resourceName, err)
	}
	resource.SetManagedFields(nil)
	data, err := yaml.Marshal(resource)
	if err != nil {
		return "", fmt.Errorf("failed to marshal %s: %w", resourceName, err)
	}
	return string(data), nil
}

// GetServiceYAML retrieves the YAML manifest for a Service
func (a *App) GetServiceYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "service", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetIngressYAML retrieves the YAML manifest for an Ingress
func (a *App) GetIngressYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "ingress", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.NetworkingV1().Ingresses(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetJobYAML retrieves the YAML manifest for a Job
func (a *App) GetJobYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "job", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.BatchV1().Jobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetCronJobYAML retrieves the YAML manifest for a CronJob
func (a *App) GetCronJobYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "cronjob", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.BatchV1().CronJobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetConfigMapYAML retrieves the YAML manifest for a ConfigMap
func (a *App) GetConfigMapYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "configmap", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.CoreV1().ConfigMaps(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetSecretYAML retrieves the YAML manifest for a Secret
// Note: Secret data values are shown as-is (base64 encoded) from the API
func (a *App) GetSecretYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "secret", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetPersistentVolumeYAML retrieves the YAML manifest for a PV (cluster-scoped)
func (a *App) GetPersistentVolumeYAML(name string) (string, error) {
	return a.getResourceYAML("", name, false, "persistent volume", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.CoreV1().PersistentVolumes().Get(context.Background(), name, metav1.GetOptions{})
	})
}

// GetPersistentVolumeClaimYAML retrieves the YAML manifest for a PVC
func (a *App) GetPersistentVolumeClaimYAML(namespace, name string) (string, error) {
	return a.getResourceYAML(namespace, name, true, "persistent volume claim", func(clientset kubernetes.Interface) (metav1.Object, error) {
		return clientset.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), name, metav1.GetOptions{})
	})
}
