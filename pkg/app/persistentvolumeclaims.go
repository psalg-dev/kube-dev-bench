package app

import (
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetPersistentVolumeClaims returns all persistent volume claims in a namespace
func (a *App) GetPersistentVolumeClaims(namespace string) ([]PersistentVolumeClaimInfo, error) {
	clientset, err := a.getClientsetForResource()
	if err != nil {
		return nil, err
	}

	pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []PersistentVolumeClaimInfo
	now := time.Now()

	for _, pvc := range pvcs.Items {
		pvcInfo := buildPVCInfo(pvc, now)
		result = append(result, pvcInfo)
	}

	return result, nil
}

// buildPVCInfo builds PersistentVolumeClaimInfo from a PVC resource
func buildPVCInfo(pvc corev1.PersistentVolumeClaim, now time.Time) PersistentVolumeClaimInfo {
	age := "-"
	if pvc.CreationTimestamp.Time != (time.Time{}) {
		age = formatDuration(now.Sub(pvc.CreationTimestamp.Time))
	}

	status := string(pvc.Status.Phase)

	volume := "-"
	if pvc.Spec.VolumeName != "" {
		volume = pvc.Spec.VolumeName
	}

	capacity := extractPVCCapacity(pvc)
	accessModes := formatPVCAccessModes(pvc.Spec.AccessModes)

	storageClass := "-"
	if pvc.Spec.StorageClassName != nil {
		storageClass = *pvc.Spec.StorageClassName
	}

	return PersistentVolumeClaimInfo{
		Name:         pvc.Name,
		Namespace:    pvc.Namespace,
		Status:       status,
		Volume:       volume,
		Capacity:     capacity,
		AccessModes:  accessModes,
		StorageClass: storageClass,
		Age:          age,
		Labels:       pvc.Labels,
	}
}

// extractPVCCapacity extracts the storage capacity from a PVC
func extractPVCCapacity(pvc corev1.PersistentVolumeClaim) string {
	if pvc.Status.Capacity != nil {
		if storage, ok := pvc.Status.Capacity["storage"]; ok {
			return storage.String()
		}
	}
	return "-"
}

// formatPVCAccessModes formats PVC access modes as abbreviated strings
func formatPVCAccessModes(modes []corev1.PersistentVolumeAccessMode) string {
	if len(modes) == 0 {
		return "-"
	}

	modeStrs := make([]string, len(modes))
	for i, mode := range modes {
		switch mode {
		case "ReadWriteOnce":
			modeStrs[i] = "RWO"
		case "ReadOnlyMany":
			modeStrs[i] = "ROX"
		case "ReadWriteMany":
			modeStrs[i] = "RWX"
		case "ReadWriteOncePod":
			modeStrs[i] = "RWOP"
		default:
			modeStrs[i] = string(mode)
		}
	}
	return strings.Join(modeStrs, ",")
}
