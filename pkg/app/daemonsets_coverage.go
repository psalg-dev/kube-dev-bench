package app

import (
	"fmt"
	"sort"

	v1 "k8s.io/api/core/v1"
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

// isOwnedByDaemonSet checks if a pod is owned by the specified DaemonSet
func isOwnedByDaemonSet(pod *v1.Pod, daemonSetName string) bool {
	for _, ref := range pod.OwnerReferences {
		if ref.Kind == "DaemonSet" && ref.Name == daemonSetName {
			return true
		}
	}
	return false
}

// calculateReadyString computes the ready count string for a pod
func calculateReadyString(pod *v1.Pod) string {
	total := len(pod.Spec.Containers)
	if total == 0 {
		return "0/0"
	}
	readyCount := 0
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Ready {
			readyCount++
		}
	}
	return fmt.Sprintf("%d/%d", readyCount, total)
}

// buildCoverageEntry creates a DaemonSetNodeCoverageEntry for a pod
func buildCoverageEntry(pod v1.Pod) DaemonSetNodeCoverageEntry {
	return DaemonSetNodeCoverageEntry{
		Node:      pod.Spec.NodeName,
		HasPod:    true,
		PodName:   pod.Name,
		PodStatus: string(pod.Status.Phase),
		Ready:     calculateReadyString(&pod),
	}
}

// collectPodsByNode builds a map of node name to coverage entry for DaemonSet pods
func collectPodsByNode(pods []v1.Pod, daemonSetName string) map[string]DaemonSetNodeCoverageEntry {
	podsByNode := make(map[string]DaemonSetNodeCoverageEntry)
	for _, pod := range pods {
		if !isOwnedByDaemonSet(&pod, daemonSetName) {
			continue
		}
		nodeName := pod.Spec.NodeName
		if nodeName == "" {
			continue
		}
		if _, exists := podsByNode[nodeName]; !exists {
			podsByNode[nodeName] = buildCoverageEntry(pod)
		}
	}
	return podsByNode
}

// buildCoverageEntries creates a sorted list of coverage entries for all nodes
func buildCoverageEntries(nodes *v1.NodeList, podsByNode map[string]DaemonSetNodeCoverageEntry) []DaemonSetNodeCoverageEntry {
	entries := make([]DaemonSetNodeCoverageEntry, 0, len(nodes.Items))
	for _, n := range nodes.Items {
		if e, ok := podsByNode[n.Name]; ok {
			entries = append(entries, e)
		} else {
			entries = append(entries, DaemonSetNodeCoverageEntry{Node: n.Name, HasPod: false})
		}
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Node < entries[j].Node })
	return entries
}

// Test helpers exported for unit tests
func BuildCoverageEntriesForTest(nodes *v1.NodeList, podsByNode map[string]DaemonSetNodeCoverageEntry) []DaemonSetNodeCoverageEntry {
	return buildCoverageEntries(nodes, podsByNode)
}

func CollectPodsByNodeForTest(pods []v1.Pod, daemonSetName string) map[string]DaemonSetNodeCoverageEntry {
	return collectPodsByNode(pods, daemonSetName)
}

func CalculateReadyStringForTest(pod *v1.Pod) string {
	return calculateReadyString(pod)
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

	selector := labels.SelectorFromSet(ds.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return nil, err
	}

	podsByNode := collectPodsByNode(pods.Items, daemonSetName)
	entries := buildCoverageEntries(nodes, podsByNode)
	return &DaemonSetNodeCoverage{Nodes: entries}, nil
}
