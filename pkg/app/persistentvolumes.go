package app

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetPersistentVolumes returns all persistent volumes in the cluster
func (a *App) GetPersistentVolumes() ([]PersistentVolumeInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
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
			dur := now.Sub(pv.CreationTimestamp.Time)
			age = formatDuration(dur)
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
		if pv.Spec.PersistentVolumeSource.HostPath != nil {
			volumeType = "HostPath"
		} else if pv.Spec.PersistentVolumeSource.NFS != nil {
			volumeType = "NFS"
		} else if pv.Spec.PersistentVolumeSource.CSI != nil {
			volumeType = "CSI"
		} else if pv.Spec.PersistentVolumeSource.AWSElasticBlockStore != nil {
			volumeType = "AWSElasticBlockStore"
		} else if pv.Spec.PersistentVolumeSource.GCEPersistentDisk != nil {
			volumeType = "GCEPersistentDisk"
		} else if pv.Spec.PersistentVolumeSource.AzureDisk != nil {
			volumeType = "AzureDisk"
		} else if pv.Spec.PersistentVolumeSource.CephFS != nil {
			volumeType = "CephFS"
		} else if pv.Spec.PersistentVolumeSource.Cinder != nil {
			volumeType = "Cinder"
		} else if pv.Spec.PersistentVolumeSource.FC != nil {
			volumeType = "FC"
		} else if pv.Spec.PersistentVolumeSource.FlexVolume != nil {
			volumeType = "FlexVolume"
		} else if pv.Spec.PersistentVolumeSource.Flocker != nil {
			volumeType = "Flocker"
		} else if pv.Spec.PersistentVolumeSource.Glusterfs != nil {
			volumeType = "Glusterfs"
		} else if pv.Spec.PersistentVolumeSource.ISCSI != nil {
			volumeType = "ISCSI"
		} else if pv.Spec.PersistentVolumeSource.PhotonPersistentDisk != nil {
			volumeType = "PhotonPersistentDisk"
		} else if pv.Spec.PersistentVolumeSource.PortworxVolume != nil {
			volumeType = "PortworxVolume"
		} else if pv.Spec.PersistentVolumeSource.Quobyte != nil {
			volumeType = "Quobyte"
		} else if pv.Spec.PersistentVolumeSource.RBD != nil {
			volumeType = "RBD"
		} else if pv.Spec.PersistentVolumeSource.ScaleIO != nil {
			volumeType = "ScaleIO"
		} else if pv.Spec.PersistentVolumeSource.StorageOS != nil {
			volumeType = "StorageOS"
		} else if pv.Spec.PersistentVolumeSource.VsphereVolume != nil {
			volumeType = "VsphereVolume"
		} else if pv.Spec.PersistentVolumeSource.Local != nil {
			volumeType = "Local"
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
			Age:           age,
			Labels:        pv.Labels,
			Annotations:   pv.Annotations, // Added
		})
	}

	return result, nil
}
