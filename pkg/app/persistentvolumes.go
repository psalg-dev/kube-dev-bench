package app

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetPersistentVolumes returns all persistent volumes in the cluster
func (a *App) GetPersistentVolumes() ([]PersistentVolumeInfo, error) {
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

	pvs, err := clientset.CoreV1().PersistentVolumes().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []PersistentVolumeInfo
	now := time.Now()

	for _, pv := range pvs.Items {
		age := "-"
		if pv.CreationTimestamp.Time != (time.Time{}) {
			age = formatDuration(now.Sub(pv.CreationTimestamp.Time))
		}

		// Get status
		status := string(pv.Status.Phase)

		// Get capacity
		capacity := "-"
		if pv.Spec.Capacity != nil {
			if storage, ok := pv.Spec.Capacity["storage"]; ok {
				capacity = storage.String()
			}
		}

		// Get access modes
		accessModes := "-"
		if len(pv.Spec.AccessModes) > 0 {
			modes := make([]string, len(pv.Spec.AccessModes))
			for i, mode := range pv.Spec.AccessModes {
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

		// Get reclaim policy
		reclaimPolicy := "-"
		if pv.Spec.PersistentVolumeReclaimPolicy != "" {
			reclaimPolicy = string(pv.Spec.PersistentVolumeReclaimPolicy)
		}

		// Get storage class
		storageClass := "-"
		if pv.Spec.StorageClassName != "" {
			storageClass = pv.Spec.StorageClassName
		}

		// Get claim reference
		claim := "-"
		if pv.Spec.ClaimRef != nil {
			claim = fmt.Sprintf("%s/%s", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name)
		}

		// Get volume source type
		volumeType := "-"
		switch {
		case pv.Spec.PersistentVolumeSource.HostPath != nil:
			volumeType = "HostPath"
		case pv.Spec.PersistentVolumeSource.NFS != nil:
			volumeType = "NFS"
		case pv.Spec.PersistentVolumeSource.CSI != nil:
			volumeType = "CSI"
		case pv.Spec.PersistentVolumeSource.AWSElasticBlockStore != nil:
			volumeType = "AWSElasticBlockStore"
		case pv.Spec.PersistentVolumeSource.GCEPersistentDisk != nil:
			volumeType = "GCEPersistentDisk"
		case pv.Spec.PersistentVolumeSource.AzureDisk != nil:
			volumeType = "AzureDisk"
		case pv.Spec.PersistentVolumeSource.CephFS != nil:
			volumeType = "CephFS"
		case pv.Spec.PersistentVolumeSource.Cinder != nil:
			volumeType = "Cinder"
		case pv.Spec.PersistentVolumeSource.FC != nil:
			volumeType = "FC"
		case pv.Spec.PersistentVolumeSource.FlexVolume != nil:
			volumeType = "FlexVolume"
		case pv.Spec.PersistentVolumeSource.Flocker != nil:
			volumeType = "Flocker"
		case pv.Spec.PersistentVolumeSource.Glusterfs != nil:
			volumeType = "Glusterfs"
		case pv.Spec.PersistentVolumeSource.ISCSI != nil:
			volumeType = "ISCSI"
		case pv.Spec.PersistentVolumeSource.PhotonPersistentDisk != nil:
			volumeType = "PhotonPersistentDisk"
		case pv.Spec.PersistentVolumeSource.PortworxVolume != nil:
			volumeType = "PortworxVolume"
		case pv.Spec.PersistentVolumeSource.Quobyte != nil:
			volumeType = "Quobyte"
		case pv.Spec.PersistentVolumeSource.RBD != nil:
			volumeType = "RBD"
		case pv.Spec.PersistentVolumeSource.ScaleIO != nil:
			volumeType = "ScaleIO"
		case pv.Spec.PersistentVolumeSource.StorageOS != nil:
			volumeType = "StorageOS"
		case pv.Spec.PersistentVolumeSource.VsphereVolume != nil:
			volumeType = "VsphereVolume"
		case pv.Spec.PersistentVolumeSource.Local != nil:
			volumeType = "Local"
		}

		volumeMode := ""
		if pv.Spec.VolumeMode != nil {
			volumeMode = string(*pv.Spec.VolumeMode)
		}

		result = append(result, PersistentVolumeInfo{
			Name:          pv.Name,
			Capacity:      capacity,
			AccessModes:   accessModes,
			ReclaimPolicy: reclaimPolicy,
			Status:        status,
			Claim:         claim,
			StorageClass:  storageClass,
			VolumeType:    volumeType,
			Reason:        pv.Status.Reason,
			VolumeMode:    volumeMode,
			Age:           age,
			Labels:        pv.Labels,
			Annotations:   pv.Annotations,
		})
	}

	return result, nil
}
