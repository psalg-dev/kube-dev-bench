package app

import (
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PVCConsumer struct {
	PodName string `json:"podName"`
	Node    string `json:"node"`
	Status  string `json:"status"`
	RefType string `json:"refType,omitempty"`
}

// GetPVCConsumers returns Pods in the namespace that mount the given PVC.
func (a *App) GetPVCConsumers(namespace, pvcName string) ([]PVCConsumer, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	if pvcName == "" {
		return nil, fmt.Errorf("pvc name is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := make([]PVCConsumer, 0)
	for _, p := range pods.Items {
		why := ""
		for _, v := range p.Spec.Volumes {
			if v.PersistentVolumeClaim != nil && v.PersistentVolumeClaim.ClaimName == pvcName {
				why = fmt.Sprintf("volume:%s", v.Name)
				break
			}
		}
		if why == "" {
			continue
		}
		out = append(out, PVCConsumer{
			PodName: p.Name,
			Node:    p.Spec.NodeName,
			Status:  string(p.Status.Phase),
			RefType: why,
		})
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].PodName != out[j].PodName {
			return out[i].PodName < out[j].PodName
		}
		return out[i].RefType < out[j].RefType
	})

	return out, nil
}
