package app

import (
	"fmt"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type DaemonSetNodeCoverageEntry struct {
	Node      string `json:"node"`
	HasPod    bool   `json:"hasPod"`
	PodName   string `json:"podName,omitempty"`
	PodStatus string `json:"podStatus,omitempty"`
	Ready     string `json:"ready,omitempty"`
}

type DaemonSetNodeCoverage struct {
	Nodes []DaemonSetNodeCoverageEntry `json:"nodes"`
}

// GetDaemonSetNodeCoverage returns a best-effort view of which nodes have a DaemonSet pod.
// This is a simple coverage view: every cluster node is listed, and nodes with at least one
// pod owned by the DaemonSet are marked as covered.
func (a *App) GetDaemonSetNodeCoverage(namespace, daemonSetName string) (*DaemonSetNodeCoverage, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ds, err := clientset.AppsV1().DaemonSets(namespace).Get(a.ctx, daemonSetName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	nodes, err := clientset.CoreV1().Nodes().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	// Build map nodeName -> pod summary
	podsByNode := map[string]DaemonSetNodeCoverageEntry{}
	selector := labels.SelectorFromSet(ds.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err == nil {
		for _, pod := range pods.Items {
			// Verify ownership
			isOwned := false
			for _, ref := range pod.OwnerReferences {
				if ref.Kind == "DaemonSet" && ref.Name == daemonSetName {
					isOwned = true
					break
				}
			}
			if !isOwned {
				continue
			}

			ready := "0/0"
			total := len(pod.Spec.Containers)
			readyCount := 0
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					readyCount++
				}
			}
			if total > 0 {
				ready = fmt.Sprintf("%d/%d", readyCount, total)
			}

			nodeName := pod.Spec.NodeName
			if nodeName == "" {
				continue
			}
			// Keep first seen pod for a node.
			if _, exists := podsByNode[nodeName]; !exists {
				podsByNode[nodeName] = DaemonSetNodeCoverageEntry{
					Node:      nodeName,
					HasPod:    true,
					PodName:   pod.Name,
					PodStatus: string(pod.Status.Phase),
					Ready:     ready,
				}
			}
		}
	}

	entries := make([]DaemonSetNodeCoverageEntry, 0, len(nodes.Items))
	for _, n := range nodes.Items {
		if e, ok := podsByNode[n.Name]; ok {
			entries = append(entries, e)
			continue
		}
		entries = append(entries, DaemonSetNodeCoverageEntry{Node: n.Name, HasPod: false})
	}

	sort.Slice(entries, func(i, j int) bool { return entries[i].Node < entries[j].Node })
	return &DaemonSetNodeCoverage{Nodes: entries}, nil
}
