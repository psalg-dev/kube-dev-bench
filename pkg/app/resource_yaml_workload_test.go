package app

import (
	"context"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ---------------------------------------------------------------------------
// TestGetConfigMapYAML
// ---------------------------------------------------------------------------

func TestGetConfigMapYAML_HappyPath(t *testing.T) {
	cs := fake.NewSimpleClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "my-cm", Namespace: "default"},
		Data:       map[string]string{"key": "value"},
	})
	app := newTestAppWithClientset(cs)
	yaml, err := app.GetConfigMapYAML("default", "my-cm")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(yaml, "key") {
		t.Errorf("expected key in YAML: %s", yaml)
	}
}

func TestGetConfigMapYAML_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetConfigMapYAML("", "my-cm")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetConfigMapYAML_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetConfigMapYAML("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing configmap")
	}
}

// ---------------------------------------------------------------------------
// TestGetDeploymentYAML – missing error paths
// ---------------------------------------------------------------------------

func TestGetDeploymentYAML_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetDeploymentYAML("", "my-deploy")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetDeploymentYAML_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetDeploymentYAML("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing deployment")
	}
}

// ---------------------------------------------------------------------------
// TestGetStatefulSetYAML – missing error paths
// ---------------------------------------------------------------------------

func TestGetStatefulSetYAML_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetStatefulSetYAML("", "my-sts")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetStatefulSetYAML_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetStatefulSetYAML("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing statefulset")
	}
}

// ---------------------------------------------------------------------------
// TestGetDaemonSetYAML – missing error paths
// ---------------------------------------------------------------------------

func TestGetDaemonSetYAML_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetDaemonSetYAML("", "my-ds")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetDaemonSetYAML_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetDaemonSetYAML("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing daemonset")
	}
}

// ---------------------------------------------------------------------------
// TestGetReplicaSetYAML – missing error paths
// ---------------------------------------------------------------------------

func TestGetReplicaSetYAML_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetReplicaSetYAML("", "my-rs")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetReplicaSetYAML_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := newTestAppWithClientset(cs)
	_, err := app.GetReplicaSetYAML("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing replicaset")
	}
}

// ---------------------------------------------------------------------------
// TestGetResourceYAML_WorkloadKindRouting – covers switch cases not exercised
// ---------------------------------------------------------------------------

func TestGetResourceYAML_WorkloadKindRouting(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()

	// Create resources in fake clientset
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
		kind string
		name string
		want string
	}{
		{"deployment", "dep1", "Deployment"},
		{"statefulset", "sts1", "StatefulSet"},
		{"daemonset", "ds1", "DaemonSet"},
		{"replicaset", "rs1", "ReplicaSet"},
	}
	for _, tc := range tests {
		t.Run(tc.kind, func(t *testing.T) {
			yaml, err := app.GetResourceYAML(tc.kind, ns, tc.name)
			if err != nil {
				t.Fatalf("GetResourceYAML(%q) error: %v", tc.kind, err)
			}
			if !strings.Contains(yaml, tc.want) {
				t.Errorf("expected %q in YAML: %s", tc.want, yaml)
			}
		})
	}
}
