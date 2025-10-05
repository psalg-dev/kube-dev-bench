package app

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// --- Generic helpers ---

func (a *App) patchControllerAnnotation(kind, namespace, name string, patchFunc func() error) error {
	return patchFunc()
}

// --- Deployments ---
func (a *App) RestartDeployment(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().Deployments(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteDeployment(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().Deployments(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- StatefulSets ---
func (a *App) RestartStatefulSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().StatefulSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteStatefulSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().StatefulSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- DaemonSets ---
func (a *App) RestartDaemonSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().DaemonSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteDaemonSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().DaemonSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- ReplicaSets (restart not meaningful separately) ---
func (a *App) DeleteReplicaSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().ReplicaSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Jobs ---
func (a *App) DeleteJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	propagation := metav1.DeletePropagationBackground
	opts := metav1.DeleteOptions{PropagationPolicy: &propagation}
	return clientset.BatchV1().Jobs(namespace).Delete(a.ctx, name, opts)
}

// --- CronJobs ---
func (a *App) DeleteCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.BatchV1().CronJobs(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- ConfigMaps ---
func (a *App) DeleteConfigMap(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().ConfigMaps(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Secrets ---
func (a *App) DeleteSecret(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().Secrets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Persistent Volume Claims ---
func (a *App) DeletePersistentVolumeClaim(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().PersistentVolumeClaims(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Persistent Volumes ---
func (a *App) DeletePersistentVolume(name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().PersistentVolumes().Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Ingresses ---
func (a *App) DeleteIngress(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.NetworkingV1().Ingresses(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}
