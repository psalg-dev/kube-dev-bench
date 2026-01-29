package app

import (
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetPersistentVolumes returns all persistent volumes in the cluster
func (a *App) GetPersistentVolumes() ([]PersistentVolumeInfo, error) {
	clientset, err := a.getClientsetForResource()
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
		pvInfo := buildPVInfo(pv, now)
		result = append(result, pvInfo)
	}

	return result, nil
}

// buildPVInfo builds PersistentVolumeInfo from a PV resource
func buildPVInfo(pv corev1.PersistentVolume, now time.Time) PersistentVolumeInfo {
	age := "-"
	if pv.CreationTimestamp.Time != (time.Time{}) {
		age = formatDuration(now.Sub(pv.CreationTimestamp.Time))
	}

	status := string(pv.Status.Phase)
	capacity := extractPVCapacity(pv)
	accessModes := formatPVAccessModes(pv.Spec.AccessModes)
	reclaimPolicy := extractPVReclaimPolicy(pv)
	storageClass := extractPVStorageClass(pv)
	claim := extractPVClaimReference(pv)
	volumeType := extractPVVolumeType(pv)

	return PersistentVolumeInfo{
		Name:          pv.Name,
		Capacity:      capacity,
		AccessModes:   accessModes,
		ReclaimPolicy: reclaimPolicy,
		Status:        status,
		Claim:         claim,
		StorageClass:  storageClass,
		Age:           age,
		VolumeType:    volumeType,
		Labels:        pv.Labels,
	}
}

// extractPVCapacity extracts the storage capacity from a PV
func extractPVCapacity(pv corev1.PersistentVolume) string {
	if pv.Spec.Capacity != nil {
		if storage, ok := pv.Spec.Capacity["storage"]; ok {
			return storage.String()
		}
	}
	return "-"
}

// formatPVAccessModes formats PV access modes as abbreviated strings
func formatPVAccessModes(modes []corev1.PersistentVolumeAccessMode) string {
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

// extractPVReclaimPolicy extracts the reclaim policy from a PV
func extractPVReclaimPolicy(pv corev1.PersistentVolume) string {
	if pv.Spec.PersistentVolumeReclaimPolicy != "" {
		return string(pv.Spec.PersistentVolumeReclaimPolicy)
	}
	return "-"
}

// extractPVStorageClass extracts the storage class from a PV
func extractPVStorageClass(pv corev1.PersistentVolume) string {
	if pv.Spec.StorageClassName != "" {
		return pv.Spec.StorageClassName
	}
	return "-"
}

// extractPVClaimReference extracts the claim reference from a PV
func extractPVClaimReference(pv corev1.PersistentVolume) string {
	if pv.Spec.ClaimRef != nil {
		return fmt.Sprintf("%s/%s", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name)
	}
	return "-"
}

// extractPVVolumeType determines the volume source type from a PV
func extractPVVolumeType(pv corev1.PersistentVolume) string {
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
	return volumeType
}
