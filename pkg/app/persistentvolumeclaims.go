package app

import (
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// getPVCVolumeName returns the volume name or default
func getPVCVolumeName(pvc *corev1.PersistentVolumeClaim) string {
	if pvc.Spec.VolumeName != "" {
		return pvc.Spec.VolumeName
	}
	return "-"
}

// getPVCCapacity returns the storage capacity or default
func getPVCCapacity(pvc *corev1.PersistentVolumeClaim) string {
	if pvc.Status.Capacity != nil {
		if storage, ok := pvc.Status.Capacity["storage"]; ok {
			return storage.String()
		}
	}
	return "-"
}

// getPVCStorageClass returns the storage class name or default
func getPVCStorageClass(pvc *corev1.PersistentVolumeClaim) string {
	if pvc.Spec.StorageClassName != nil {
		return *pvc.Spec.StorageClassName
	}
	return "-"
}

// buildPVCListInfo constructs a PersistentVolumeClaimInfo from a PVC for list view
func buildPVCListInfo(pvc *corev1.PersistentVolumeClaim, now time.Time) PersistentVolumeClaimInfo {
	return PersistentVolumeClaimInfo{
		Name:         pvc.Name,
		Namespace:    pvc.Namespace,
		Status:       string(pvc.Status.Phase),
		Volume:       getPVCVolumeName(pvc),
		Capacity:     getPVCCapacity(pvc),
		AccessModes:  FormatAccessModes(pvc.Spec.AccessModes),
		StorageClass: getPVCStorageClass(pvc),
		Age:          FormatAge(pvc.CreationTimestamp, now),
		Labels:       pvc.Labels,
	}
}

// GetPersistentVolumeClaims returns all persistent volume claims in a namespace
func (a *App) GetPersistentVolumeClaims(namespace string) ([]PersistentVolumeClaimInfo, error) {
	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]corev1.PersistentVolumeClaim, error) {
			list, err := cs.CoreV1().PersistentVolumeClaims(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildPVCListInfo,
	)
}
