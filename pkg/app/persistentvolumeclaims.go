package app

import (
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetPersistentVolumeClaims returns all persistent volume claims in a namespace
func (a *App) GetPersistentVolumeClaims(namespace string) ([]PersistentVolumeClaimInfo, error) {
	clientset, err := a.getKubernetesClient()
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
		age := "-"
		if pvc.CreationTimestamp.Time != (time.Time{}) {
			age = formatDuration(now.Sub(pvc.CreationTimestamp.Time))
		}

		// Get status
		status := string(pvc.Status.Phase)

		// Get volume name
		volume := "-"
		if pvc.Spec.VolumeName != "" {
			volume = pvc.Spec.VolumeName
		}

		// Get capacity
		capacity := "-"
		if pvc.Status.Capacity != nil {
			if storage, ok := pvc.Status.Capacity["storage"]; ok {
				capacity = storage.String()
			}
		}

		// Get access modes
		accessModes := "-"
		if len(pvc.Spec.AccessModes) > 0 {
			modes := make([]string, len(pvc.Spec.AccessModes))
			for i, mode := range pvc.Spec.AccessModes {
				switch mode {
				case "ReadWriteOnce":
					modes[i] = "RWO"
				case "ReadOnlyMany":
					modes[i] = "ROX"
				case "ReadWriteMany":
					modes[i] = "RWX"
				case "ReadWriteOncePod":
					modes[i] = "RWOP"
				default:
					modes[i] = string(mode)
				}
			}
			accessModes = strings.Join(modes, ",")
		}

		// Get storage class
		storageClass := "-"
		if pvc.Spec.StorageClassName != nil {
			storageClass = *pvc.Spec.StorageClassName
		}

		result = append(result, PersistentVolumeClaimInfo{
			Name:         pvc.Name,
			Namespace:    pvc.Namespace,
			Status:       status,
			Volume:       volume,
			Capacity:     capacity,
			AccessModes:  accessModes,
			StorageClass: storageClass,
			Age:          age,
			Labels:       pvc.Labels,
		})
	}

	return result, nil
}
