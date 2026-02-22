package app

import (
	"fmt"
	"time"

	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// StorageClassInfo represents summary information about a Kubernetes storage class
type StorageClassInfo struct {
	Name              string            `json:"name"`
	Provisioner       string            `json:"provisioner"`
	ReclaimPolicy     string            `json:"reclaimPolicy"`
	VolumeBindingMode string            `json:"volumeBindingMode"`
	AllowVolumeExpansion bool           `json:"allowVolumeExpansion"`
	Age               string            `json:"age"`
	Labels            map[string]string `json:"labels"`
	Annotations       map[string]string `json:"annotations"`
	Parameters        map[string]string `json:"parameters"`
	Raw               interface{}       `json:"raw,omitempty"`
}

// GetStorageClasses returns all storage classes in the cluster
func (a *App) GetStorageClasses() ([]StorageClassInfo, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	storageClasses, err := clientset.StorageV1().StorageClasses().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]StorageClassInfo, 0, len(storageClasses.Items))

	for _, sc := range storageClasses.Items {
		info := buildStorageClassInfo(&sc, now)
		result = append(result, info)
	}

	return result, nil
}

// buildStorageClassInfo constructs a StorageClassInfo from a StorageClass
func buildStorageClassInfo(sc *storagev1.StorageClass, now time.Time) StorageClassInfo {
	age := "-"
	if !sc.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(sc.CreationTimestamp.Time))
	}

	reclaimPolicy := "Delete"
	if sc.ReclaimPolicy != nil {
		reclaimPolicy = string(*sc.ReclaimPolicy)
	}

	volumeBindingMode := "Immediate"
	if sc.VolumeBindingMode != nil {
		volumeBindingMode = string(*sc.VolumeBindingMode)
	}

	allowVolumeExpansion := false
	if sc.AllowVolumeExpansion != nil {
		allowVolumeExpansion = *sc.AllowVolumeExpansion
	}

	return StorageClassInfo{
		Name:                 sc.Name,
		Provisioner:          sc.Provisioner,
		ReclaimPolicy:        reclaimPolicy,
		VolumeBindingMode:    volumeBindingMode,
		AllowVolumeExpansion: allowVolumeExpansion,
		Age:                  age,
		Labels:               sc.Labels,
		Annotations:          sc.Annotations,
		Parameters:           sc.Parameters,
		Raw:                  sc,
	}
}

// GetStorageClassDetail returns detailed information about a specific storage class
func (a *App) GetStorageClassDetail(name string) (*StorageClassInfo, error) {
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	sc, err := clientset.StorageV1().StorageClasses().Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildStorageClassInfo(sc, time.Now())
	return &info, nil
}
