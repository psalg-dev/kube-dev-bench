package app

import (
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PVCConsumer struct {
	Kind      string `json:"kind,omitempty"`
	PodName   string `json:"podName"`
	Namespace string `json:"namespace,omitempty"`
	Node      string `json:"node"`
	Status    string `json:"status"`
	RefType   string `json:"refType,omitempty"`
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
			Kind:      "Pod",
			PodName:   p.Name,
			Namespace: p.Namespace,
			Node:      p.Spec.NodeName,
			Status:    string(p.Status.Phase),
			RefType:   why,
		})
	}

	// Scan Deployments
	deploys, err := clientset.AppsV1().Deployments(namespace).List(a.ctx, metav1.ListOptions{})
	if err == nil {
		for _, d := range deploys.Items {
			why := ""
			for _, v := range d.Spec.Template.Spec.Volumes {
				if v.PersistentVolumeClaim != nil && v.PersistentVolumeClaim.ClaimName == pvcName {
					why = fmt.Sprintf("volume:%s", v.Name)
					break
				}
			}
			if why != "" {
				out = append(out, PVCConsumer{
					Kind:      "Deployment",
					PodName:   d.Name,
					Namespace: d.Namespace,
					Status:    fmt.Sprintf("%d/%d ready", d.Status.ReadyReplicas, d.Status.Replicas),
					RefType:   why,
				})
			}
		}
	}

	// Scan StatefulSets
	stsList, err := clientset.AppsV1().StatefulSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range stsList.Items {
			why := ""
			for _, v := range sts.Spec.Template.Spec.Volumes {
				if v.PersistentVolumeClaim != nil && v.PersistentVolumeClaim.ClaimName == pvcName {
					why = fmt.Sprintf("volume:%s", v.Name)
					break
				}
			}
			if why != "" {
				out = append(out, PVCConsumer{
					Kind:      "StatefulSet",
					PodName:   sts.Name,
					Namespace: sts.Namespace,
					Status:    fmt.Sprintf("%d/%d ready", sts.Status.ReadyReplicas, sts.Status.Replicas),
					RefType:   why,
				})
			}
		}
	}

	// Scan DaemonSets
	dsList, err := clientset.AppsV1().DaemonSets(namespace).List(a.ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range dsList.Items {
			why := ""
			for _, v := range ds.Spec.Template.Spec.Volumes {
				if v.PersistentVolumeClaim != nil && v.PersistentVolumeClaim.ClaimName == pvcName {
					why = fmt.Sprintf("volume:%s", v.Name)
					break
				}
			}
			if why != "" {
				out = append(out, PVCConsumer{
					Kind:      "DaemonSet",
					PodName:   ds.Name,
					Namespace: ds.Namespace,
					Status:    fmt.Sprintf("%d/%d ready", ds.Status.NumberReady, ds.Status.DesiredNumberScheduled),
					RefType:   why,
				})
			}
		}
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return out[i].Kind < out[j].Kind
		}
		if out[i].PodName != out[j].PodName {
			return out[i].PodName < out[j].PodName
		}
		return out[i].RefType < out[j].RefType
	})

	return out, nil
}
