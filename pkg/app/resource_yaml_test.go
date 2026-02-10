package app

import (
	"context"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestResourceYAML_WorkloadKinds(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()

	_, _ = cs.AppsV1().Deployments(ns).Create(ctx, &appsv1.Deployment{
		TypeMeta:   metav1.TypeMeta{Kind: "Deployment", APIVersion: "apps/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "dep1", Namespace: ns},
	}, metav1.CreateOptions{})
	_, _ = cs.AppsV1().StatefulSets(ns).Create(ctx, &appsv1.StatefulSet{
		TypeMeta:   metav1.TypeMeta{Kind: "StatefulSet", APIVersion: "apps/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "sts1", Namespace: ns},
	}, metav1.CreateOptions{})
	_, _ = cs.AppsV1().DaemonSets(ns).Create(ctx, &appsv1.DaemonSet{
		TypeMeta:   metav1.TypeMeta{Kind: "DaemonSet", APIVersion: "apps/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: ns},
	}, metav1.CreateOptions{})
	_, _ = cs.AppsV1().ReplicaSets(ns).Create(ctx, &appsv1.ReplicaSet{
		TypeMeta:   metav1.TypeMeta{Kind: "ReplicaSet", APIVersion: "apps/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "rs1", Namespace: ns},
	}, metav1.CreateOptions{})

	app := newTestAppWithClientset(cs)

	tests := []struct {
		name      string
		getYAML   func() (string, error)
		wantKind  string
		wantName  string
	}{
		{
			name:     "deployment",
			getYAML:  func() (string, error) { return app.GetDeploymentYAML(ns, "dep1") },
			wantKind: "Deployment",
			wantName: "dep1",
		},
		{
			name:     "statefulset",
			getYAML:  func() (string, error) { return app.GetStatefulSetYAML(ns, "sts1") },
			wantKind: "StatefulSet",
			wantName: "sts1",
		},
		{
			name:     "daemonset",
			getYAML:  func() (string, error) { return app.GetDaemonSetYAML(ns, "ds1") },
			wantKind: "DaemonSet",
			wantName: "ds1",
		},
		{
			name:     "replicaset",
			getYAML:  func() (string, error) { return app.GetReplicaSetYAML(ns, "rs1") },
			wantKind: "ReplicaSet",
			wantName: "rs1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			yaml, err := tt.getYAML()
			if err != nil {
				t.Fatalf("Get YAML error: %v", err)
			}
			if !strings.Contains(yaml, "kind: "+tt.wantKind) {
				t.Fatalf("missing kind %s in YAML: %s", tt.wantKind, yaml)
			}
			if !strings.Contains(yaml, "name: "+tt.wantName) {
				t.Fatalf("missing name %s in YAML: %s", tt.wantName, yaml)
			}
		})
	}
}

func TestResourceYAML_NodeAndPod(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()

	_, _ = cs.CoreV1().Nodes().Create(ctx, &v1.Node{
		TypeMeta:   metav1.TypeMeta{Kind: "Node", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "node1"},
	}, metav1.CreateOptions{})
	_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
		TypeMeta:   metav1.TypeMeta{Kind: "Pod", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: ns},
	}, metav1.CreateOptions{})

	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	nodeYAML, err := app.GetResourceYAML("node", "", "node1")
	if err != nil {
		t.Fatalf("GetResourceYAML node error: %v", err)
	}
	if !strings.Contains(nodeYAML, "kind: Node") || !strings.Contains(nodeYAML, "name: node1") {
		t.Fatalf("unexpected node YAML: %s", nodeYAML)
	}

	podYAML, err := app.GetResourceYAML("pod", "", "pod1")
	if err != nil {
		t.Fatalf("GetResourceYAML pod error: %v", err)
	}
	if !strings.Contains(podYAML, "kind: Pod") || !strings.Contains(podYAML, "name: pod1") {
		t.Fatalf("unexpected pod YAML: %s", podYAML)
	}
}

func TestResourceYAML_ValidationErrors(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())

	if _, err := app.GetResourceYAML("", "default", "name"); err == nil {
		t.Fatal("expected error when kind is missing")
	}
	if _, err := app.GetResourceYAML("ConfigMap", "default", ""); err == nil {
		t.Fatal("expected error when name is missing")
	}
	if _, err := app.GetResourceYAML("Widget", "default", "name"); err == nil {
		t.Fatal("expected error for unsupported kind")
	}
}
