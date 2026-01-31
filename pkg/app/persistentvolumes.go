package app

import (
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// formatPVAccessModes formats access modes for display
func formatPVAccessModes(modes []corev1.PersistentVolumeAccessMode) string {
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

// getPVVolumeType determines the volume source type
func getPVVolumeType(spec *corev1.PersistentVolumeSpec) string {
	switch {
	case spec.PersistentVolumeSource.HostPath != nil:
		return "HostPath"
	case spec.PersistentVolumeSource.NFS != nil:
		return "NFS"
	case spec.PersistentVolumeSource.CSI != nil:
		return "CSI"
	case spec.PersistentVolumeSource.AWSElasticBlockStore != nil:
		return "AWSElasticBlockStore"
	case spec.PersistentVolumeSource.GCEPersistentDisk != nil:
		return "GCEPersistentDisk"
	case spec.PersistentVolumeSource.AzureDisk != nil:
		return "AzureDisk"
	case spec.PersistentVolumeSource.CephFS != nil:
		return "CephFS"
	case spec.PersistentVolumeSource.Cinder != nil:
		return "Cinder"
	case spec.PersistentVolumeSource.FC != nil:
		return "FC"
	case spec.PersistentVolumeSource.FlexVolume != nil:
		return "FlexVolume"
	case spec.PersistentVolumeSource.Flocker != nil:
		return "Flocker"
	case spec.PersistentVolumeSource.Glusterfs != nil:
		return "Glusterfs"
	case spec.PersistentVolumeSource.ISCSI != nil:
		return "ISCSI"
	case spec.PersistentVolumeSource.PhotonPersistentDisk != nil:
		return "PhotonPersistentDisk"
	case spec.PersistentVolumeSource.PortworxVolume != nil:
		return "PortworxVolume"
	case spec.PersistentVolumeSource.Quobyte != nil:
		return "Quobyte"
	case spec.PersistentVolumeSource.RBD != nil:
		return "RBD"
	case spec.PersistentVolumeSource.ScaleIO != nil:
		return "ScaleIO"
	case spec.PersistentVolumeSource.StorageOS != nil:
		return "StorageOS"
	case spec.PersistentVolumeSource.VsphereVolume != nil:
		return "VsphereVolume"
	case spec.PersistentVolumeSource.Local != nil:
		return "Local"
	default:
		return "-"
	}
}

// buildPVInfo creates a PersistentVolumeInfo from a PV
func buildPVInfo(pv corev1.PersistentVolume, now time.Time) PersistentVolumeInfo {
	age := "-"
	if pv.CreationTimestamp.Time != (time.Time{}) {
		age = formatDuration(now.Sub(pv.CreationTimestamp.Time))
	}

	capacity := "-"
	if pv.Spec.Capacity != nil {
		if storage, ok := pv.Spec.Capacity["storage"]; ok {
			capacity = storage.String()
		}
	}

	reclaimPolicy := "-"
	if pv.Spec.PersistentVolumeReclaimPolicy != "" {
		reclaimPolicy = string(pv.Spec.PersistentVolumeReclaimPolicy)
	}

	storageClass := "-"
	if pv.Spec.StorageClassName != "" {
		storageClass = pv.Spec.StorageClassName
	}

	claim := "-"
	if pv.Spec.ClaimRef != nil {
		claim = fmt.Sprintf("%s/%s", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name)
	}

	volumeMode := ""
	if pv.Spec.VolumeMode != nil {
		volumeMode = string(*pv.Spec.VolumeMode)
	}

	return PersistentVolumeInfo{
		Name:          pv.Name,
		Capacity:      capacity,
		AccessModes:   formatPVAccessModes(pv.Spec.AccessModes),
		ReclaimPolicy: reclaimPolicy,
		Status:        string(pv.Status.Phase),
		Claim:         claim,
		StorageClass:  storageClass,
		VolumeType:    getPVVolumeType(&pv.Spec),
		Reason:        pv.Status.Reason,
		VolumeMode:    volumeMode,
		Age:           age,
		Labels:        pv.Labels,
		Annotations:   pv.Annotations,
	}
}

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

	now := time.Now()
	result := make([]PersistentVolumeInfo, 0, len(pvs.Items))
	for _, pv := range pvs.Items {
		result = append(result, buildPVInfo(pv, now))
	}

	return result, nil
}
