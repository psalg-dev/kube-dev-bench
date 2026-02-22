package k8sgraph_test

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	appsv1 "k8s.io/api/apps/v1"
	netv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	kg "gowails/pkg/app/k8s_graph"
)

func TestBuildForNamespace_AddsSeedNodes(t *testing.T) {
	// Setup fake client with a pod, deployment, service, and ingress
	ns := "default"
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "mypod", Namespace: ns},
		Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "c1", Image: "busybox"}}},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}
	deploy := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "mydeploy", Namespace: ns},
		Spec: appsv1.DeploymentSpec{Replicas: int32Ptr(1)},
		Status: appsv1.DeploymentStatus{ReadyReplicas: 1, Replicas: 1},
	}
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "myservice", Namespace: ns},
		Spec: corev1.ServiceSpec{Type: corev1.ServiceTypeClusterIP, ClusterIP: "10.0.0.1"},
	}
	ing := &netv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "myingress", Namespace: ns},
	}

	client := fake.NewSimpleClientset(pod, deploy, svc, ing)
	b := kg.NewBuilder(context.Background(), client)
	graph, err := b.BuildForNamespace(ns, 1)
	if err != nil {
		t.Fatalf("BuildForNamespace failed: %v", err)
	}

	// Expect nodes for each resource
	expectNode := func(kind, name string) {
		id := kg.NodeID(kind, ns, name)
		if !graph.HasNode(id) {
			t.Fatalf("expected node %s to be present", id)
		}
	}

	expectNode("pod", "mypod")
	expectNode("deployment", "mydeploy")
	expectNode("service", "myservice")
	expectNode("ingress", "myingress")
}

func int32Ptr(i int32) *int32 { return &i }
