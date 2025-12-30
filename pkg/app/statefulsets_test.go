package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetStatefulSets function
func TestGetStatefulSets(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	tests := []struct {
		name         string
		namespace    string
		statefulsets []appsv1.StatefulSet
		expected     int
	}{
		{
			name:         "empty namespace",
			namespace:    "default",
			statefulsets: []appsv1.StatefulSet{},
			expected:     0,
		},
		{
			name:      "single statefulset",
			namespace: "default",
			statefulsets: []appsv1.StatefulSet{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "mysql",
						Namespace: "default",
						Labels:    map[string]string{"app": "mysql"},
					},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(3),
						Template: v1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{
								Labels: map[string]string{"app": "mysql"},
							},
							Spec: v1.PodSpec{
								Containers: []v1.Container{
									{Image: "mysql:8.0"},
								},
							},
						},
					},
					Status: appsv1.StatefulSetStatus{
						ReadyReplicas: 2,
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple statefulsets",
			namespace: "default",
			statefulsets: []appsv1.StatefulSet{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "mysql", Namespace: "default"},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "mysql:8.0"}},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "postgres", Namespace: "default"},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(2),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "postgres:14"}},
							},
						},
					},
				},
			},
			expected: 2,
		},
		{
			name:      "statefulsets in different namespaces",
			namespace: "target-ns",
			statefulsets: []appsv1.StatefulSet{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "app1", Namespace: "target-ns"},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "app1:v1"}},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "app2", Namespace: "other-ns"},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "app2:v1"}},
							},
						},
					},
				},
			},
			expected: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, ss := range tc.statefulsets {
				_, err := clientset.AppsV1().StatefulSets(ss.Namespace).Create(
					context.Background(), &ss, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create statefulset: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetStatefulSets(tc.namespace)
			if err != nil {
				t.Fatalf("GetStatefulSets failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetStatefulSets(%q) returned %d statefulsets, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetStatefulSets_Details(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	clientset := fake.NewSimpleClientset()
	ss := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "mysql",
			Namespace: "default",
			Labels:    map[string]string{"app": "mysql", "tier": "database"},
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: int32Ptr(5),
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": "mysql", "version": "8.0"},
				},
				Spec: v1.PodSpec{
					Containers: []v1.Container{
						{Image: "mysql:8.0"},
					},
				},
			},
		},
		Status: appsv1.StatefulSetStatus{
			ReadyReplicas: 3,
		},
	}

	_, err := clientset.AppsV1().StatefulSets("default").Create(
		context.Background(), ss, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetStatefulSets("default")
	if err != nil {
		t.Fatalf("GetStatefulSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 statefulset, got %d", len(result))
	}

	s := result[0]
	if s.Name != "mysql" {
		t.Errorf("expected name 'mysql', got %q", s.Name)
	}
	if s.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", s.Namespace)
	}
	if s.Replicas != 5 {
		t.Errorf("expected replicas 5, got %d", s.Replicas)
	}
	if s.Ready != 3 {
		t.Errorf("expected ready 3, got %d", s.Ready)
	}
	if s.Image != "mysql:8.0" {
		t.Errorf("expected image 'mysql:8.0', got %q", s.Image)
	}
	// Labels should include both statefulset and template labels
	if s.Labels["app"] != "mysql" {
		t.Errorf("expected label app=mysql, got %q", s.Labels["app"])
	}
	if s.Labels["tier"] != "database" {
		t.Errorf("expected label tier=database, got %q", s.Labels["tier"])
	}
	// Template label should be included if not overriding
	if s.Labels["version"] != "8.0" {
		t.Errorf("expected label version=8.0, got %q", s.Labels["version"])
	}
}

func TestGetStatefulSets_NilReplicas(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	ss := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-ss",
			Namespace: "default",
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: nil, // nil replicas should default to 0
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{{Image: "test:v1"}},
				},
			},
		},
	}

	_, err := clientset.AppsV1().StatefulSets("default").Create(
		context.Background(), ss, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetStatefulSets("default")
	if err != nil {
		t.Fatalf("GetStatefulSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 statefulset, got %d", len(result))
	}

	if result[0].Replicas != 0 {
		t.Errorf("expected replicas 0 for nil spec.replicas, got %d", result[0].Replicas)
	}
}

func TestGetStatefulSets_NoContainers(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }
	clientset := fake.NewSimpleClientset()
	ss := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "empty-containers",
			Namespace: "default",
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: int32Ptr(1),
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{}, // no containers
				},
			},
		},
	}

	_, err := clientset.AppsV1().StatefulSets("default").Create(
		context.Background(), ss, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetStatefulSets("default")
	if err != nil {
		t.Fatalf("GetStatefulSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 statefulset, got %d", len(result))
	}

	if result[0].Image != "" {
		t.Errorf("expected empty image for no containers, got %q", result[0].Image)
	}
}
