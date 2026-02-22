package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── GetReplicaSetDetail with owner references ───────────────────────────────

// TestGetReplicaSetDetail_WithOwnerRef covers the "ref.Controller != nil &&
// *ref.Controller" branch inside the OwnerReferences loop.
func TestGetReplicaSetDetail_WithOwnerRef(t *testing.T) {
	isController := true
	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "owned-rs",
			Namespace: "default",
			OwnerReferences: []metav1.OwnerReference{
				{
					Kind:       "Deployment",
					Name:       "parent-deploy",
					Controller: &isController,
				},
			},
		},
		Spec: appsv1.ReplicaSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "owned"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "owned"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c", Image: "busybox"}}},
			},
		},
	}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(rs)}
	detail, err := app.GetReplicaSetDetail("default", "owned-rs")
	if err != nil {
		t.Fatalf("GetReplicaSetDetail error: %v", err)
	}
	if detail.OwnerName != "parent-deploy" {
		t.Errorf("expected OwnerName=parent-deploy, got %q", detail.OwnerName)
	}
	if detail.OwnerKind != "Deployment" {
		t.Errorf("expected OwnerKind=Deployment, got %q", detail.OwnerKind)
	}
}

// TestGetReplicaSetDetail_NotFound covers the ReplicaSet Get error path.
func TestGetReplicaSetDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetReplicaSetDetail("default", "ghost-rs")
	if err == nil {
		t.Error("expected error for nonexistent ReplicaSet")
	}
}

// ─── GetConfigMapDataByName with BinaryData ───────────────────────────────────

// TestGetConfigMapDataByName_WithBinaryData exercises the BinaryData loop in
// GetConfigMapDataByName.
func TestGetConfigMapDataByName_WithBinaryData(t *testing.T) {
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "cm-binary", Namespace: "default"},
		Data:       map[string]string{"key1": "value1"},
		BinaryData: map[string][]byte{"bin-key": {0x01, 0x02, 0x03}},
	}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(cm)}
	data, err := app.GetConfigMapDataByName("default", "cm-binary")
	if err != nil {
		t.Fatalf("GetConfigMapDataByName error: %v", err)
	}
	var hasBinary bool
	for _, d := range data {
		if d.IsBinary {
			hasBinary = true
		}
	}
	if !hasBinary {
		t.Error("expected at least one BinaryData entry")
	}
}

// ─── GetSecretDataByName with binary value ────────────────────────────────────

// TestGetSecretDataByName_WithBinaryValue exercises the isBinary=true branch in
// GetSecretDataByName (when the byte value contains a non-printable control byte
// other than \n, \r, \t).
func TestGetSecretDataByName_WithBinaryValue(t *testing.T) {
	sec := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "sec-binary", Namespace: "default"},
		Data: map[string][]byte{
			"printable-key": []byte("hello world"),
			"binary-key":    {0x01, 0x02, 0x03}, // control bytes → isBinary
		},
	}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(sec)}
	data, err := app.GetSecretDataByName("default", "sec-binary")
	if err != nil {
		t.Fatalf("GetSecretDataByName error: %v", err)
	}
	var hasBinary bool
	for _, d := range data {
		if d.IsBinary {
			hasBinary = true
		}
	}
	if !hasBinary {
		t.Error("expected at least one IsBinary=true entry")
	}
}

// ─── getPodYAMLWithNamespace: empty namespace and not-found paths ─────────────

// TestGetPodYAMLWithNamespace_EmptyNS covers the "namespace required" check.
func TestGetPodYAMLWithNamespace_EmptyNS(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.getPodYAMLWithNamespace("", "pod")
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

// TestGetPodYAMLWithNamespace_NotFound covers the Pod Get error path.
func TestGetPodYAMLWithNamespace_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.getPodYAMLWithNamespace("default", "ghost-pod")
	if err == nil {
		t.Error("expected error for nonexistent pod")
	}
}

// TestGetPodYAMLWithNamespace_HappyPath covers the full success path including
// yaml.Marshal.
func TestGetPodYAMLWithNamespace_HappyPath(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "my-pod", Namespace: "default"},
		Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c", Image: "busybox"}}},
	}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(pod)}
	yaml, err := app.getPodYAMLWithNamespace("default", "my-pod")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if yaml == "" {
		t.Error("expected non-empty YAML output")
	}
}
