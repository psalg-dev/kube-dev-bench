package app

import (
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func mapPersistentVolumeInfo(pv corev1.PersistentVolume, now time.Time) PersistentVolumeInfo {
	return PersistentVolumeInfo{
		Name:          pv.Name,
		Capacity:      pvCapacity(pv),
		AccessModes:   pvAccessModes(pv),
		ReclaimPolicy: pvReclaimPolicy(pv),
		Status:        string(pv.Status.Phase),
		Claim:         pvClaim(pv),
		StorageClass:  pvStorageClass(pv),
		VolumeType:    pvVolumeType(pv),
		Reason:        pv.Status.Reason,
		VolumeMode:    pvVolumeMode(pv),
		Age:           pvAge(pv, now),
		Labels:        pv.Labels,
		Annotations:   pv.Annotations,
	}
}

func pvAge(pv corev1.PersistentVolume, now time.Time) string {
	if pv.CreationTimestamp.Time == (time.Time{}) {
		return "-"
	}
	return formatDuration(now.Sub(pv.CreationTimestamp.Time))
}

func pvCapacity(pv corev1.PersistentVolume) string {
	if pv.Spec.Capacity == nil {
		return "-"
	}
	storage, ok := pv.Spec.Capacity["storage"]
	if !ok {
		return "-"
	}
	return storage.String()
}

func pvAccessModes(pv corev1.PersistentVolume) string {
	if len(pv.Spec.AccessModes) == 0 {
		return "-"
	}
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
	return strings.Join(modes, ",")
}

func pvReclaimPolicy(pv corev1.PersistentVolume) string {
	if pv.Spec.PersistentVolumeReclaimPolicy == "" {
		return "-"
	}
	return string(pv.Spec.PersistentVolumeReclaimPolicy)
}

func pvStorageClass(pv corev1.PersistentVolume) string {
	if pv.Spec.StorageClassName == "" {
		return "-"
	}
	return pv.Spec.StorageClassName
}

func pvClaim(pv corev1.PersistentVolume) string {
	if pv.Spec.ClaimRef == nil {
		return "-"
	}
	return fmt.Sprintf("%s/%s", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name)
}

func pvVolumeType(pv corev1.PersistentVolume) string {
	source := pv.Spec.PersistentVolumeSource
	switch {
	case source.HostPath != nil:
		return "HostPath"
	case source.NFS != nil:
		return "NFS"
	case source.CSI != nil:
		return "CSI"
	case source.AWSElasticBlockStore != nil:
		return "AWSElasticBlockStore"
	case source.GCEPersistentDisk != nil:
		return "GCEPersistentDisk"
	case source.AzureDisk != nil:
		return "AzureDisk"
	case source.CephFS != nil:
		return "CephFS"
	case source.Cinder != nil:
		return "Cinder"
	case source.FC != nil:
		return "FC"
	case source.FlexVolume != nil:
		return "FlexVolume"
	case source.Flocker != nil:
		return "Flocker"
	case source.Glusterfs != nil:
		return "Glusterfs"
	case source.ISCSI != nil:
		return "ISCSI"
	case source.PhotonPersistentDisk != nil:
		return "PhotonPersistentDisk"
	case source.PortworxVolume != nil:
		return "PortworxVolume"
	case source.Quobyte != nil:
		return "Quobyte"
	case source.RBD != nil:
		return "RBD"
	case source.ScaleIO != nil:
		return "ScaleIO"
	case source.StorageOS != nil:
		return "StorageOS"
	case source.VsphereVolume != nil:
		return "VsphereVolume"
	case source.Local != nil:
		return "Local"
	default:
		return "-"
	}
}

func pvVolumeMode(pv corev1.PersistentVolume) string {
	if pv.Spec.VolumeMode == nil {
		return ""
	}
	return string(*pv.Spec.VolumeMode)
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

	result := make([]PersistentVolumeInfo, 0, len(pvs.Items))
	now := time.Now()

	for _, pv := range pvs.Items {
		result = append(result, mapPersistentVolumeInfo(pv, now))
	}

	return result, nil
}
