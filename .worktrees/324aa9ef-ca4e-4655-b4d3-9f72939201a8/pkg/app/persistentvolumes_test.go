package app

import (
	"context"
	"testing"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetPersistentVolumes function
func TestGetPersistentVolumes(t *testing.T) {
	tests := []struct {
		name     string
		pvs      []v1.PersistentVolume
		expected int
	}{
		{
			name:     "empty cluster",
			pvs:      []v1.PersistentVolume{},
			expected: 0,
		},
		{
			name: "single pv",
			pvs: []v1.PersistentVolume{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:   "pv-1",
						Labels: map[string]string{"type": "local"},
					},
					Spec: v1.PersistentVolumeSpec{
						Capacity: v1.ResourceList{
							"storage": resource.MustParse("10Gi"),
						},
						AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
						PersistentVolumeSource: v1.PersistentVolumeSource{
							HostPath: &v1.HostPathVolumeSource{Path: "/data"},
						},
						PersistentVolumeReclaimPolicy: v1.PersistentVolumeReclaimRetain,
						StorageClassName:              "standard",
					},
					Status: v1.PersistentVolumeStatus{
						Phase: v1.VolumeAvailable,
					},
				},
			},
			expected: 1,
		},
		{
			name: "multiple pvs",
			pvs: []v1.PersistentVolume{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pv-1"},
					Spec: v1.PersistentVolumeSpec{
						Capacity: v1.ResourceList{"storage": resource.MustParse("10Gi")},
						PersistentVolumeSource: v1.PersistentVolumeSource{
							HostPath: &v1.HostPathVolumeSource{Path: "/data1"},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pv-2"},
					Spec: v1.PersistentVolumeSpec{
						Capacity: v1.ResourceList{"storage": resource.MustParse("20Gi")},
						PersistentVolumeSource: v1.PersistentVolumeSource{
							HostPath: &v1.HostPathVolumeSource{Path: "/data2"},
						},
					},
				},
			},
			expected: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, pv := range tc.pvs {
				_, err := clientset.CoreV1().PersistentVolumes().Create(
					context.Background(), &pv, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create pv: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetPersistentVolumes()
			if err != nil {
				t.Fatalf("GetPersistentVolumes failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetPersistentVolumes() returned %d pvs, want %d",
					len(result), tc.expected)
			}
		})
	}
}

func TestGetPersistentVolumes_Details(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	pv := &v1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "test-pv",
			Labels:      map[string]string{"type": "local"},
			Annotations: map[string]string{"note": "test annotation"},
		},
		Spec: v1.PersistentVolumeSpec{
			Capacity: v1.ResourceList{
				"storage": resource.MustParse("100Gi"),
			},
			AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce, v1.ReadOnlyMany},
			PersistentVolumeSource: v1.PersistentVolumeSource{
				HostPath: &v1.HostPathVolumeSource{Path: "/mnt/data"},
			},
			PersistentVolumeReclaimPolicy: v1.PersistentVolumeReclaimDelete,
			StorageClassName:              "fast",
			ClaimRef: &v1.ObjectReference{
				Namespace: "default",
				Name:      "my-claim",
			},
		},
		Status: v1.PersistentVolumeStatus{
			Phase: v1.VolumeBound,
		},
	}

	_, err := clientset.CoreV1().PersistentVolumes().Create(
		context.Background(), pv, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pv: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetPersistentVolumes()
	if err != nil {
		t.Fatalf("GetPersistentVolumes failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 pv, got %d", len(result))
	}

	p := result[0]
	if p.Name != "test-pv" {
		t.Errorf("expected name 'test-pv', got %q", p.Name)
	}
	if p.Capacity != "100Gi" {
		t.Errorf("expected capacity '100Gi', got %q", p.Capacity)
	}
	if p.StorageClass != "fast" {
		t.Errorf("expected storageClass 'fast', got %q", p.StorageClass)
	}
	if p.Status != "Bound" {
		t.Errorf("expected status 'Bound', got %q", p.Status)
	}
	if p.Claim != "default/my-claim" {
		t.Errorf("expected claim 'default/my-claim', got %q", p.Claim)
	}
	if p.ReclaimPolicy != "Delete" {
		t.Errorf("expected reclaimPolicy 'Delete', got %q", p.ReclaimPolicy)
	}
	// Check labels
	if p.Labels["type"] != "local" {
		t.Errorf("expected label type=local, got %q", p.Labels["type"])
	}
}

func TestGetPersistentVolumes_AccessModes(t *testing.T) {
	tests := []struct {
		name        string
		accessModes []v1.PersistentVolumeAccessMode
		expected    string
	}{
		{
			name:        "RWO only",
			accessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
			expected:    "RWO",
		},
		{
			name:        "ROX only",
			accessModes: []v1.PersistentVolumeAccessMode{v1.ReadOnlyMany},
			expected:    "ROX",
		},
		{
			name:        "RWX only",
			accessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteMany},
			expected:    "RWX",
		},
		{
			name:        "multiple modes",
			accessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce, v1.ReadOnlyMany},
			expected:    "RWO,ROX",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			pv := &v1.PersistentVolume{
				ObjectMeta: metav1.ObjectMeta{Name: "test-pv"},
				Spec: v1.PersistentVolumeSpec{
					Capacity:    v1.ResourceList{"storage": resource.MustParse("1Gi")},
					AccessModes: tc.accessModes,
					PersistentVolumeSource: v1.PersistentVolumeSource{
						HostPath: &v1.HostPathVolumeSource{Path: "/data"},
					},
				},
			}

			_, err := clientset.CoreV1().PersistentVolumes().Create(
				context.Background(), pv, metav1.CreateOptions{})
			if err != nil {
				t.Fatalf("failed to create pv: %v", err)
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetPersistentVolumes()
			if err != nil {
				t.Fatalf("GetPersistentVolumes failed: %v", err)
			}

			if len(result) != 1 {
				t.Fatalf("expected 1 pv, got %d", len(result))
			}

			if result[0].AccessModes != tc.expected {
				t.Errorf("expected accessModes %q, got %q", tc.expected, result[0].AccessModes)
			}
		})
	}
}
