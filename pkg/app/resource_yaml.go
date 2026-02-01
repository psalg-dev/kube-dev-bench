package app

import (
	"context"
	"fmt"
	"strings"

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

// GetDeploymentYAML retrieves the YAML manifest for a Deployment
func (a *App) GetDeploymentYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	deployment, err := clientset.AppsV1().Deployments(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get deployment: %w", err)
	}
	deployment.ManagedFields = nil
	data, err := yaml.Marshal(deployment)
	if err != nil {
		return "", fmt.Errorf("failed to marshal deployment: %w", err)
	}
	return string(data), nil
}

// GetStatefulSetYAML retrieves the YAML manifest for a StatefulSet
func (a *App) GetStatefulSetYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	ss, err := clientset.AppsV1().StatefulSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get statefulset: %w", err)
	}
	ss.ManagedFields = nil
	data, err := yaml.Marshal(ss)
	if err != nil {
		return "", fmt.Errorf("failed to marshal statefulset: %w", err)
	}
	return string(data), nil
}

// GetDaemonSetYAML retrieves the YAML manifest for a DaemonSet
func (a *App) GetDaemonSetYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	ds, err := clientset.AppsV1().DaemonSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get daemonset: %w", err)
	}
	ds.ManagedFields = nil
	data, err := yaml.Marshal(ds)
	if err != nil {
		return "", fmt.Errorf("failed to marshal daemonset: %w", err)
	}
	return string(data), nil
}

// GetReplicaSetYAML retrieves the YAML manifest for a ReplicaSet
func (a *App) GetReplicaSetYAML(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	rs, err := clientset.AppsV1().ReplicaSets(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get replicaset: %w", err)
	}
	rs.ManagedFields = nil
	data, err := yaml.Marshal(rs)
	if err != nil {
		return "", fmt.Errorf("failed to marshal replicaset: %w", err)
	}
	return string(data), nil
}

// GetNodeYAML retrieves the YAML manifest for a Node (cluster-scoped)
func (a *App) GetNodeYAML(name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	node, err := clientset.CoreV1().Nodes().Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get node: %w", err)
	}
	node.ManagedFields = nil
	data, err := yaml.Marshal(node)
	if err != nil {
		return "", fmt.Errorf("failed to marshal node: %w", err)
	}
	return string(data), nil
}

// GetResourceYAML is a generic method that delegates to specific Get*YAML methods based on kind
func (a *App) GetResourceYAML(kind, namespace, name string) (string, error) {
	if kind == "" {
		return "", fmt.Errorf("missing required parameter: kind")
	}
	if name == "" {
		return "", fmt.Errorf("missing required parameter: name")
	}

	// Normalize kind to lowercase for comparison
	kindLower := strings.ToLower(kind)

	// Cluster-scoped resources (no namespace required)
	switch kindLower {
	case "node", "nodes":
		return a.GetNodeYAML(name)
	case "persistentvolume", "persistentvolumes", "pv":
		return a.GetPersistentVolumeYAML(name)
	}

	// Namespaced resources require namespace
	// If namespace is empty, use current namespace for GetPodYAML which expects it
	if namespace == "" {
		namespace = a.currentNamespace
		if namespace == "" {
			return "", fmt.Errorf("missing required parameter: namespace")
		}
	}

	switch kindLower {
	case "pod", "pods":
		// GetPodYAML in pod_details.go uses internal namespace, so we need to temporarily set it
		// Or we can create a wrapper that accepts namespace
		return a.getPodYAMLWithNamespace(namespace, name)
	case "deployment", "deployments":
		return a.GetDeploymentYAML(namespace, name)
	case "statefulset", "statefulsets":
		return a.GetStatefulSetYAML(namespace, name)
	case "daemonset", "daemonsets":
		return a.GetDaemonSetYAML(namespace, name)
	case "replicaset", "replicasets":
		return a.GetReplicaSetYAML(namespace, name)
	case "service", "services", "svc":
		return a.GetServiceYAML(namespace, name)
	case "ingress", "ingresses":
		return a.GetIngressYAML(namespace, name)
	case "job", "jobs":
		return a.GetJobYAML(namespace, name)
	case "cronjob", "cronjobs":
		return a.GetCronJobYAML(namespace, name)
	case "configmap", "configmaps", "cm":
		return a.GetConfigMapYAML(namespace, name)
	case "secret", "secrets":
		return a.GetSecretYAML(namespace, name)
	case "persistentvolumeclaim", "persistentvolumeclaims", "pvc":
		return a.GetPersistentVolumeClaimYAML(namespace, name)
	default:
		return "", fmt.Errorf("unsupported resource kind: %s", kind)
	}
}

// getPodYAMLWithNamespace is a helper that gets pod YAML for a specific namespace
func (a *App) getPodYAMLWithNamespace(namespace, name string) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", fmt.Errorf("not connected to cluster: %w", err)
	}
	pod, err := clientset.CoreV1().Pods(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get pod: %w", err)
	}
	pod.ManagedFields = nil
	data, err := yaml.Marshal(pod)
	if err != nil {
		return "", fmt.Errorf("failed to marshal pod: %w", err)
	}
	return string(data), nil
}
