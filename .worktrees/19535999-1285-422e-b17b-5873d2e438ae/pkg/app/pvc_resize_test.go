package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestResizePersistentVolumeClaim_Success(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-pvc",
				Namespace: "default",
			},
			Spec: corev1.PersistentVolumeClaimSpec{
				Resources: corev1.VolumeResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceStorage: resource.MustParse("1Gi"),
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	err := app.ResizePersistentVolumeClaim("default", "my-pvc", "5Gi")
	if err != nil {
		t.Fatalf("ResizePersistentVolumeClaim failed: %v", err)
	}

	// Verify the PVC was updated
	pvc, err := clientset.CoreV1().PersistentVolumeClaims("default").Get(ctx, "my-pvc", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get updated PVC: %v", err)
	}

	newSize := pvc.Spec.Resources.Requests[corev1.ResourceStorage]
	expected := resource.MustParse("5Gi")
	if !newSize.Equal(expected) {
		t.Errorf("expected size 5Gi, got %s", newSize.String())
	}
}

func TestResizePersistentVolumeClaim_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.ResizePersistentVolumeClaim("", "my-pvc", "5Gi")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
	if err.Error() != "namespace is required" {
		t.Errorf("expected 'namespace is required', got '%v'", err)
	}
}

func TestResizePersistentVolumeClaim_EmptyPVCName(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.ResizePersistentVolumeClaim("default", "", "5Gi")
	if err == nil {
		t.Fatal("expected error for empty PVC name")
	}
	if err.Error() != "pvc name is required" {
		t.Errorf("expected 'pvc name is required', got '%v'", err)
	}
}

func TestResizePersistentVolumeClaim_EmptyNewSize(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.ResizePersistentVolumeClaim("default", "my-pvc", "")
	if err == nil {
		t.Fatal("expected error for empty new size")
	}
	if err.Error() != "new size is required" {
		t.Errorf("expected 'new size is required', got '%v'", err)
	}
}

func TestResizePersistentVolumeClaim_InvalidSize(t *testing.T) {
	app := &App{ctx: context.Background()}

	err := app.ResizePersistentVolumeClaim("default", "my-pvc", "not-a-size")
	if err == nil {
		t.Fatal("expected error for invalid size")
	}
}

func TestResizePersistentVolumeClaim_PVCNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	err := app.ResizePersistentVolumeClaim("default", "nonexistent", "5Gi")
	if err == nil {
		t.Fatal("expected error for nonexistent PVC")
	}
}

func TestResizePersistentVolumeClaim_NilResourcesRequests(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-pvc",
				Namespace: "default",
			},
			Spec: corev1.PersistentVolumeClaimSpec{
				// No Resources.Requests set
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	err := app.ResizePersistentVolumeClaim("default", "my-pvc", "5Gi")
	if err != nil {
		t.Fatalf("ResizePersistentVolumeClaim failed: %v", err)
	}

	// Verify the PVC was updated
	pvc, err := clientset.CoreV1().PersistentVolumeClaims("default").Get(ctx, "my-pvc", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get updated PVC: %v", err)
	}

	newSize := pvc.Spec.Resources.Requests[corev1.ResourceStorage]
	expected := resource.MustParse("5Gi")
	if !newSize.Equal(expected) {
		t.Errorf("expected size 5Gi, got %s", newSize.String())
	}
}
