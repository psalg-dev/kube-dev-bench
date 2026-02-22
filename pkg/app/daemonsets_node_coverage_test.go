//go:build ignore
// +build ignore

package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetDaemonSetNodeCoverage(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	// Nodes
	_, _ = clientset.CoreV1().Nodes().Create(context.Background(), &corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-a"}}, metav1.CreateOptions{})
	_, _ = clientset.CoreV1().Nodes().Create(context.Background(), &corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-b"}}, metav1.CreateOptions{})

	// DaemonSet
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test-ds"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test-ds"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c", Image: "busybox"}}},
			},
		},
	}
	_, err := clientset.AppsV1().DaemonSets("default").Create(context.Background(), ds, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create daemonset: %v", err)
	}

	// Pod on node-a owned by the DaemonSet
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-ds-pod",
			Namespace: "default",
			Labels:    map[string]string{"app": "test-ds"},
			OwnerReferences: []metav1.OwnerReference{{
				Kind: "DaemonSet",
				Name: "test-ds",
			}},
		},
		Spec: corev1.PodSpec{
			NodeName: "node-a",
			Containers: []corev1.Container{{
				Name:  "c",
				Image: "busybox",
			}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}
	_, err = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	cov, err := app.GetDaemonSetNodeCoverage("default", "test-ds")
	if err != nil {
		t.Fatalf("GetDaemonSetNodeCoverage failed: %v", err)
	}
	if cov == nil || len(cov.Nodes) != 2 {
		t.Fatalf("expected 2 nodes in coverage, got %#v", cov)
	}

	foundA := false
	foundB := false
	for _, n := range cov.Nodes {
		if n.Node == "node-a" {
			foundA = true
			if !n.HasPod {
				t.Errorf("expected node-a to be covered")
			}
			if n.PodName != "test-ds-pod" {
				t.Errorf("expected node-a pod name 'test-ds-pod', got %q", n.PodName)
			}
		}
		if n.Node == "node-b" {
			foundB = true
			if n.HasPod {
				t.Errorf("expected node-b to be missing")
			}
		}
	}
	if !foundA || !foundB {
		t.Errorf("expected both nodes present, got %+v", cov.Nodes)
	}
}

