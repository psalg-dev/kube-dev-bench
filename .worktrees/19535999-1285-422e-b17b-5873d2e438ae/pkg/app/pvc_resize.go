package app

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ResizePersistentVolumeClaim updates the requested storage size for a PVC.
// Note: actual expansion depends on the StorageClass allowing expansion.
func (a *App) ResizePersistentVolumeClaim(namespace, pvcName, newSize string) error {
	if namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if pvcName == "" {
		return fmt.Errorf("pvc name is required")
	}
	if newSize == "" {
		return fmt.Errorf("new size is required")
	}

	qty, err := resource.ParseQuantity(newSize)
	if err != nil {
		return fmt.Errorf("invalid size '%s': %w", newSize, err)
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}

	pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(a.ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		return err
	}

	if pvc.Spec.Resources.Requests == nil {
		pvc.Spec.Resources.Requests = corev1.ResourceList{}
	}
	pvc.Spec.Resources.Requests[corev1.ResourceStorage] = qty

	_, err = clientset.CoreV1().PersistentVolumeClaims(namespace).Update(a.ctx, pvc, metav1.UpdateOptions{})
	return err
}
