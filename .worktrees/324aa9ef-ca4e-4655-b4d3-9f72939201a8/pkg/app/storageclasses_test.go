package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetStorageClasses_ReturnsStorageClasses(t *testing.T) {
	ctx := context.Background()

	reclaimPolicy := corev1.PersistentVolumeReclaimDelete
	volumeBindingMode := storagev1.VolumeBindingImmediate
	allowExpansion := true

	clientset := fake.NewSimpleClientset(
		&storagev1.StorageClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "fast-storage",
				Labels: map[string]string{
					"type": "ssd",
				},
				Annotations: map[string]string{
					"description": "Fast SSD storage",
				},
			},
			Provisioner:          "kubernetes.io/aws-ebs",
			ReclaimPolicy:        &reclaimPolicy,
			VolumeBindingMode:    &volumeBindingMode,
			AllowVolumeExpansion: &allowExpansion,
			Parameters: map[string]string{
				"type": "gp3",
				"iops": "3000",
			},
		},
		&storagev1.StorageClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "standard",
			},
			Provisioner: "kubernetes.io/gce-pd",
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	storageClasses, err := app.GetStorageClasses()
	if err != nil {
		t.Fatalf("GetStorageClasses failed: %v", err)
	}

	if len(storageClasses) != 2 {
		t.Fatalf("expected 2 storage classes, got %d", len(storageClasses))
	}

	// Verify first storage class details
	if storageClasses[0].Name != "fast-storage" {
		t.Errorf("expected storage class name 'fast-storage', got '%s'", storageClasses[0].Name)
	}
	if storageClasses[0].Provisioner != "kubernetes.io/aws-ebs" {
		t.Errorf("expected provisioner 'kubernetes.io/aws-ebs', got '%s'", storageClasses[0].Provisioner)
	}
	if storageClasses[0].ReclaimPolicy != "Delete" {
		t.Errorf("expected reclaim policy 'Delete', got '%s'", storageClasses[0].ReclaimPolicy)
	}
	if !storageClasses[0].AllowVolumeExpansion {
		t.Errorf("expected allow volume expansion to be true")
	}
	if storageClasses[0].Parameters["type"] != "gp3" {
		t.Errorf("expected parameter type=gp3, got %v", storageClasses[0].Parameters)
	}
}

func TestGetStorageClasses_NoStorageClasses(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	storageClasses, err := app.GetStorageClasses()
	if err != nil {
		t.Fatalf("GetStorageClasses failed: %v", err)
	}

	if len(storageClasses) != 0 {
		t.Errorf("expected 0 storage classes, got %d", len(storageClasses))
	}
}

func TestGetStorageClassDetail_ReturnsStorageClass(t *testing.T) {
	ctx := context.Background()

	reclaimPolicy := corev1.PersistentVolumeReclaimRetain
	volumeBindingMode := storagev1.VolumeBindingWaitForFirstConsumer

	clientset := fake.NewSimpleClientset(
		&storagev1.StorageClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "fast-storage",
				Labels: map[string]string{
					"type": "ssd",
				},
			},
			Provisioner:       "kubernetes.io/aws-ebs",
			ReclaimPolicy:     &reclaimPolicy,
			VolumeBindingMode: &volumeBindingMode,
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	sc, err := app.GetStorageClassDetail("fast-storage")
	if err != nil {
		t.Fatalf("GetStorageClassDetail failed: %v", err)
	}

	if sc.Name != "fast-storage" {
		t.Errorf("expected storage class name 'fast-storage', got '%s'", sc.Name)
	}
	if sc.ReclaimPolicy != "Retain" {
		t.Errorf("expected reclaim policy 'Retain', got '%s'", sc.ReclaimPolicy)
	}
	if sc.VolumeBindingMode != "WaitForFirstConsumer" {
		t.Errorf("expected volume binding mode 'WaitForFirstConsumer', got '%s'", sc.VolumeBindingMode)
	}
}

func TestGetStorageClassDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetStorageClassDetail("")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestBuildStorageClassInfo_Defaults(t *testing.T) {
	sc := &storagev1.StorageClass{
		ObjectMeta: metav1.ObjectMeta{
			Name: "default-storage",
		},
		Provisioner: "kubernetes.io/no-provisioner",
	}

	info := buildStorageClassInfo(sc, metav1.Now().Time)

	if info.ReclaimPolicy != "Delete" {
		t.Errorf("expected default reclaim policy 'Delete', got '%s'", info.ReclaimPolicy)
	}
	if info.VolumeBindingMode != "Immediate" {
		t.Errorf("expected default volume binding mode 'Immediate', got '%s'", info.VolumeBindingMode)
	}
	if info.AllowVolumeExpansion {
		t.Errorf("expected default allow volume expansion to be false")
	}
}
