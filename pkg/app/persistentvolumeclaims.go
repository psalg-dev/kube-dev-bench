package app

import (
	"strings"
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

// formatPVCAccessModes converts access modes to short form
func formatPVCAccessModes(modes []corev1.PersistentVolumeAccessMode) string {
	if len(modes) == 0 {
		return "-"
	}
	result := make([]string, len(modes))
	for i, mode := range modes {
		switch mode {
		case "ReadWriteOnce":
			result[i] = "RWO"
		case "ReadOnlyMany":
			result[i] = "ROX"
		case "ReadWriteMany":
			result[i] = "RWX"
		case "ReadWriteOncePod":
			result[i] = "RWOP"
		default:
			result[i] = string(mode)
		}
	}
	return strings.Join(result, ",")
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
	age := "-"
	if !pvc.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(pvc.CreationTimestamp.Time))
	}

	return PersistentVolumeClaimInfo{
		Name:         pvc.Name,
		Namespace:    pvc.Namespace,
		Status:       string(pvc.Status.Phase),
		Volume:       getPVCVolumeName(pvc),
		Capacity:     getPVCCapacity(pvc),
		AccessModes:  formatPVCAccessModes(pvc.Spec.AccessModes),
		StorageClass: getPVCStorageClass(pvc),
		Age:          age,
		Labels:       pvc.Labels,
	}
}

// GetPersistentVolumeClaims returns all persistent volume claims in a namespace
func (a *App) GetPersistentVolumeClaims(namespace string) ([]PersistentVolumeClaimInfo, error) {
	var clientset kubernetes.Interface
	var err error
	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
		clientset, err = a.getKubernetesClient()
		if err != nil {
			return nil, err
		}
	}

	pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]PersistentVolumeClaimInfo, 0, len(pvcs.Items))
	for _, pvc := range pvcs.Items {
		result = append(result, buildPVCListInfo(&pvc, now))
	}

	return result, nil
}

// StartPersistentVolumeClaimPolling emits persistentvolumeclaims:update events periodically
func (a *App) StartPersistentVolumeClaimPolling() {
	startResourcePolling(a, ResourcePollingConfig[PersistentVolumeClaimInfo]{
		EventName: "persistentvolumeclaims:update",
		FetchFn:   a.GetPersistentVolumeClaims,
	})
}
