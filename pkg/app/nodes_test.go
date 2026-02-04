package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetNodes_ReturnsNodes(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Node{
			ObjectMeta: metav1.ObjectMeta{
				Name: "node-1",
				Labels: map[string]string{
					"node-role.kubernetes.io/control-plane": "",
					"kubernetes.io/hostname":                "node-1",
				},
			},
			Status: corev1.NodeStatus{
				Conditions: []corev1.NodeCondition{
					{
						Type:   corev1.NodeReady,
						Status: corev1.ConditionTrue,
					},
				},
				Addresses: []corev1.NodeAddress{
					{
						Type:    corev1.NodeInternalIP,
						Address: "10.0.0.1",
					},
				},
				NodeInfo: corev1.NodeSystemInfo{
					KubeletVersion:           "v1.28.0",
					OSImage:                  "Ubuntu 22.04",
					KernelVersion:            "5.15.0",
					ContainerRuntimeVersion:  "containerd://1.7.0",
				},
				Allocatable: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse("4"),
					corev1.ResourceMemory: resource.MustParse("8Gi"),
				},
			},
		},
		&corev1.Node{
			ObjectMeta: metav1.ObjectMeta{
				Name: "node-2",
				Labels: map[string]string{
					"node-role.kubernetes.io/worker": "",
				},
			},
			Status: corev1.NodeStatus{
				Conditions: []corev1.NodeCondition{
					{
						Type:   corev1.NodeReady,
						Status: corev1.ConditionTrue,
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	nodes, err := app.GetNodes()
	if err != nil {
		t.Fatalf("GetNodes failed: %v", err)
	}

	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(nodes))
	}

	// Verify first node details
	if nodes[0].Name != "node-1" {
		t.Errorf("expected node name 'node-1', got '%s'", nodes[0].Name)
	}
	if nodes[0].Status != "Ready" {
		t.Errorf("expected status 'Ready', got '%s'", nodes[0].Status)
	}
	if nodes[0].InternalIP != "10.0.0.1" {
		t.Errorf("expected internal IP '10.0.0.1', got '%s'", nodes[0].InternalIP)
	}
}

func TestGetNodes_NoNodes(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	nodes, err := app.GetNodes()
	if err != nil {
		t.Fatalf("GetNodes failed: %v", err)
	}

	if len(nodes) != 0 {
		t.Errorf("expected 0 nodes, got %d", len(nodes))
	}
}

func TestGetNodeDetail_ReturnsNode(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Node{
			ObjectMeta: metav1.ObjectMeta{
				Name: "node-1",
				Labels: map[string]string{
					"node-role.kubernetes.io/control-plane": "",
				},
			},
			Status: corev1.NodeStatus{
				Conditions: []corev1.NodeCondition{
					{
						Type:   corev1.NodeReady,
						Status: corev1.ConditionTrue,
					},
				},
			},
			Spec: corev1.NodeSpec{
				Taints: []corev1.Taint{
					{
						Key:    "node-role.kubernetes.io/control-plane",
						Effect: corev1.TaintEffectNoSchedule,
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	node, err := app.GetNodeDetail("node-1")
	if err != nil {
		t.Fatalf("GetNodeDetail failed: %v", err)
	}

	if node.Name != "node-1" {
		t.Errorf("expected node name 'node-1', got '%s'", node.Name)
	}

	if len(node.Taints) != 1 {
		t.Errorf("expected 1 taint, got %d", len(node.Taints))
	}
}

func TestGetNodeDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetNodeDetail("")
	if err == nil {
		t.Fatal("expected error for empty node name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestExtractNodeRoles_ControlPlane(t *testing.T) {
	labels := map[string]string{
		"node-role.kubernetes.io/control-plane": "",
	}

	roles := extractNodeRoles(labels)

	if len(roles) != 1 || roles[0] != "control-plane" {
		t.Errorf("expected control-plane role, got %v", roles)
	}
}

func TestExtractNodeRoles_Worker(t *testing.T) {
	labels := map[string]string{
		"node-role.kubernetes.io/worker": "",
	}

	roles := extractNodeRoles(labels)

	if len(roles) != 1 || roles[0] != "worker" {
		t.Errorf("expected worker role, got %v", roles)
	}
}

func TestExtractNodeRoles_NoRoleLabels(t *testing.T) {
	labels := map[string]string{
		"kubernetes.io/hostname": "node-1",
	}

	roles := extractNodeRoles(labels)

	if len(roles) != 1 || roles[0] != "worker" {
		t.Errorf("expected default worker role, got %v", roles)
	}
}
