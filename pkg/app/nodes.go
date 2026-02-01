package app

import (
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NodeInfo represents summary information about a Kubernetes node
type NodeInfo struct {
	Name              string            `json:"name"`
	Status            string            `json:"status"`
	Roles             []string          `json:"roles"`
	Age               string            `json:"age"`
	Version           string            `json:"version"`
	InternalIP        string            `json:"internalIP"`
	ExternalIP        string            `json:"externalIP"`
	OSImage           string            `json:"osImage"`
	KernelVersion     string            `json:"kernelVersion"`
	ContainerRuntime  string            `json:"containerRuntime"`
	Labels            map[string]string `json:"labels"`
	Annotations       map[string]string `json:"annotations"`
	Taints            []NodeTaint       `json:"taints"`
	AllocatableMemory string            `json:"allocatableMemory"`
	AllocatableCPU    string            `json:"allocatableCPU"`
	Raw               interface{}       `json:"raw,omitempty"`
}

// NodeTaint represents a node taint
type NodeTaint struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Effect string `json:"effect"`
}

// GetNodes returns all Kubernetes nodes
func (a *App) GetNodes() ([]NodeInfo, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	nodes, err := clientset.CoreV1().Nodes().List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]NodeInfo, 0, len(nodes.Items))

	for _, node := range nodes.Items {
		info := buildNodeInfo(&node, now)
		result = append(result, info)
	}

	return result, nil
}

// buildNodeInfo constructs a NodeInfo from a Node
func buildNodeInfo(node *corev1.Node, now time.Time) NodeInfo {
	age := "-"
	if !node.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(node.CreationTimestamp.Time))
	}

	// Extract node status
	status := "Unknown"
	for _, condition := range node.Status.Conditions {
		if condition.Type == corev1.NodeReady {
			if condition.Status == corev1.ConditionTrue {
				status = "Ready"
			} else {
				status = "NotReady"
			}
			break
		}
	}

	// Extract node roles
	roles := extractNodeRoles(node.Labels)

	// Extract IP addresses
	internalIP := ""
	externalIP := ""
	for _, addr := range node.Status.Addresses {
		switch addr.Type {
		case corev1.NodeInternalIP:
			internalIP = addr.Address
		case corev1.NodeExternalIP:
			externalIP = addr.Address
		}
	}

	// Extract taints
	taints := make([]NodeTaint, 0, len(node.Spec.Taints))
	for _, taint := range node.Spec.Taints {
		taints = append(taints, NodeTaint{
			Key:    taint.Key,
			Value:  taint.Value,
			Effect: string(taint.Effect),
		})
	}

	// Extract allocatable resources
	allocatableCPU := node.Status.Allocatable.Cpu().String()
	allocatableMemory := node.Status.Allocatable.Memory().String()

	return NodeInfo{
		Name:              node.Name,
		Status:            status,
		Roles:             roles,
		Age:               age,
		Version:           node.Status.NodeInfo.KubeletVersion,
		InternalIP:        internalIP,
		ExternalIP:        externalIP,
		OSImage:           node.Status.NodeInfo.OSImage,
		KernelVersion:     node.Status.NodeInfo.KernelVersion,
		ContainerRuntime:  node.Status.NodeInfo.ContainerRuntimeVersion,
		Labels:            node.Labels,
		Annotations:       node.Annotations,
		Taints:            taints,
		AllocatableCPU:    allocatableCPU,
		AllocatableMemory: allocatableMemory,
		Raw:               node,
	}
}

// extractNodeRoles extracts roles from node labels
func extractNodeRoles(labels map[string]string) []string {
	roles := []string{}
	for key := range labels {
		if key == "node-role.kubernetes.io/master" || key == "node-role.kubernetes.io/control-plane" {
			roles = append(roles, "control-plane")
		} else if key == "node-role.kubernetes.io/worker" {
			roles = append(roles, "worker")
		}
	}
	if len(roles) == 0 {
		roles = append(roles, "worker")
	}
	return roles
}

// GetNodeDetail returns detailed information about a specific node
func (a *App) GetNodeDetail(nodeName string) (*NodeInfo, error) {
	if nodeName == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	node, err := clientset.CoreV1().Nodes().Get(a.ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := buildNodeInfo(node, time.Now())
	return &info, nil
}
