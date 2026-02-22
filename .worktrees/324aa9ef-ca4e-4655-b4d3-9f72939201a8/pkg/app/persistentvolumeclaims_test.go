package app

import (
	"context"
	"testing"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetPersistentVolumeClaims function
func TestGetPersistentVolumeClaims(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		pvcs      []v1.PersistentVolumeClaim
		expected  int
	}{
		{
			name:      "empty namespace",
			namespace: "default",
			pvcs:      []v1.PersistentVolumeClaim{},
			expected:  0,
		},
		{
			name:      "single pvc",
			namespace: "default",
			pvcs: []v1.PersistentVolumeClaim{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "data-pvc",
						Namespace: "default",
						Labels:    map[string]string{"app": "myapp"},
					},
					Spec: v1.PersistentVolumeClaimSpec{
						AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
						Resources: v1.VolumeResourceRequirements{
							Requests: v1.ResourceList{
								"storage": resource.MustParse("10Gi"),
							},
						},
					},
					Status: v1.PersistentVolumeClaimStatus{
						Phase: v1.ClaimBound,
						Capacity: v1.ResourceList{
							"storage": resource.MustParse("10Gi"),
						},
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple pvcs",
			namespace: "default",
			pvcs: []v1.PersistentVolumeClaim{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pvc-1", Namespace: "default"},
					Spec: v1.PersistentVolumeClaimSpec{
						AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pvc-2", Namespace: "default"},
					Spec: v1.PersistentVolumeClaimSpec{
						AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteMany},
					},
				},
			},
			expected: 2,
		},
		{
			name:      "pvcs in different namespaces",
			namespace: "target-ns",
			pvcs: []v1.PersistentVolumeClaim{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pvc-1", Namespace: "target-ns"},
					Spec: v1.PersistentVolumeClaimSpec{
						AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "pvc-2", Namespace: "other-ns"},
					Spec: v1.PersistentVolumeClaimSpec{
						AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
					},
				},
			},
			expected: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, pvc := range tc.pvcs {
				_, err := clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Create(
					context.Background(), &pvc, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create pvc: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetPersistentVolumeClaims(tc.namespace)
			if err != nil {
				t.Fatalf("GetPersistentVolumeClaims failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetPersistentVolumeClaims(%q) returned %d pvcs, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetPersistentVolumeClaims_Details(t *testing.T) {
	storageClass := "fast-storage"
	clientset := fake.NewSimpleClientset()
	pvc := &v1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "database-pvc",
			Namespace: "default",
			Labels:    map[string]string{"app": "postgres"},
		},
		Spec: v1.PersistentVolumeClaimSpec{
			AccessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
			Resources: v1.VolumeResourceRequirements{
				Requests: v1.ResourceList{
					"storage": resource.MustParse("50Gi"),
				},
			},
			VolumeName:       "pv-0001",
			StorageClassName: &storageClass,
		},
		Status: v1.PersistentVolumeClaimStatus{
			Phase: v1.ClaimBound,
			Capacity: v1.ResourceList{
				"storage": resource.MustParse("50Gi"),
			},
		},
	}

	_, err := clientset.CoreV1().PersistentVolumeClaims("default").Create(
		context.Background(), pvc, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pvc: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetPersistentVolumeClaims("default")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaims failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 pvc, got %d", len(result))
	}

	p := result[0]
	if p.Name != "database-pvc" {
		t.Errorf("expected name 'database-pvc', got %q", p.Name)
	}
	if p.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", p.Namespace)
	}
	if p.Capacity != "50Gi" {
		t.Errorf("expected capacity '50Gi', got %q", p.Capacity)
	}
	if p.Volume != "pv-0001" {
		t.Errorf("expected volume 'pv-0001', got %q", p.Volume)
	}
	if p.Status != "Bound" {
		t.Errorf("expected status 'Bound', got %q", p.Status)
	}
	if p.StorageClass != "fast-storage" {
		t.Errorf("expected storageClass 'fast-storage', got %q", p.StorageClass)
	}
	if p.AccessModes != "RWO" {
		t.Errorf("expected accessModes 'RWO', got %q", p.AccessModes)
	}
	// Check labels
	if p.Labels["app"] != "postgres" {
		t.Errorf("expected label app=postgres, got %q", p.Labels["app"])
	}
}

func TestGetPersistentVolumeClaims_AccessModes(t *testing.T) {
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
			name:        "RWX only",
			accessModes: []v1.PersistentVolumeAccessMode{v1.ReadWriteMany},
			expected:    "RWX",
		},
		{
			name:        "ROX only",
			accessModes: []v1.PersistentVolumeAccessMode{v1.ReadOnlyMany},
			expected:    "ROX",
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
			pvc := &v1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{Name: "test-pvc", Namespace: "default"},
				Spec: v1.PersistentVolumeClaimSpec{
					AccessModes: tc.accessModes,
				},
			}

			_, err := clientset.CoreV1().PersistentVolumeClaims("default").Create(
				context.Background(), pvc, metav1.CreateOptions{})
			if err != nil {
				t.Fatalf("failed to create pvc: %v", err)
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetPersistentVolumeClaims("default")
			if err != nil {
				t.Fatalf("GetPersistentVolumeClaims failed: %v", err)
			}

			if len(result) != 1 {
				t.Fatalf("expected 1 pvc, got %d", len(result))
			}

			if result[0].AccessModes != tc.expected {
				t.Errorf("expected accessModes %q, got %q", tc.expected, result[0].AccessModes)
			}
		})
	}
}
