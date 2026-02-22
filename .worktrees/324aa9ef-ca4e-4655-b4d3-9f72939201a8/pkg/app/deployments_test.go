package app

import (
	"context"
	"fmt"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

// Tests for GetDeployments function
func TestGetDeployments(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	tests := []struct {
		name        string
		namespace   string
		deployments []appsv1.Deployment
		expected    int
	}{
		{
			name:        "empty namespace",
			namespace:   "default",
			deployments: []appsv1.Deployment{},
			expected:    0,
		},
		{
			name:      "single deployment",
			namespace: "default",
			deployments: []appsv1.Deployment{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "nginx",
						Namespace: "default",
						Labels:    map[string]string{"app": "nginx"},
					},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(3),
						Template: v1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{
								Labels: map[string]string{"app": "nginx"},
							},
							Spec: v1.PodSpec{
								Containers: []v1.Container{
									{Image: "nginx:latest"},
								},
							},
						},
					},
					Status: appsv1.DeploymentStatus{
						ReadyReplicas:     2,
						AvailableReplicas: 2,
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple deployments",
			namespace: "default",
			deployments: []appsv1.Deployment{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "nginx", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "nginx:1.0"}},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "redis", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(2),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "redis:6"}},
							},
						},
					},
				},
			},
			expected: 2,
		},
		{
			name:      "deployments in different namespaces",
			namespace: "target-ns",
			deployments: []appsv1.Deployment{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "app1", Namespace: "target-ns"},
					Spec: appsv1.DeploymentSpec{
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
					Spec: appsv1.DeploymentSpec{
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
			for _, dep := range tc.deployments {
				_, err := clientset.AppsV1().Deployments(dep.Namespace).Create(
					context.Background(), &dep, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create deployment: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetDeployments(tc.namespace)
			if err != nil {
				t.Fatalf("GetDeployments failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetDeployments(%q) returned %d deployments, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetDeployments_DeploymentDetails(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	clientset := fake.NewSimpleClientset()
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "nginx",
			Namespace: "default",
			Labels:    map[string]string{"app": "nginx", "tier": "frontend"},
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: int32Ptr(5),
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": "nginx", "version": "1.0"},
				},
				Spec: v1.PodSpec{
					Containers: []v1.Container{
						{Image: "nginx:1.19"},
					},
				},
			},
		},
		Status: appsv1.DeploymentStatus{
			ReadyReplicas:     3,
			AvailableReplicas: 4,
		},
	}

	_, err := clientset.AppsV1().Deployments("default").Create(
		context.Background(), dep, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetDeployments("default")
	if err != nil {
		t.Fatalf("GetDeployments failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 deployment, got %d", len(result))
	}

	d := result[0]
	if d.Name != "nginx" {
		t.Errorf("expected name 'nginx', got %q", d.Name)
	}
	if d.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", d.Namespace)
	}
	if d.Replicas != 5 {
		t.Errorf("expected replicas 5, got %d", d.Replicas)
	}
	if d.Ready != 3 {
		t.Errorf("expected ready 3, got %d", d.Ready)
	}
	if d.Available != 4 {
		t.Errorf("expected available 4, got %d", d.Available)
	}
	if d.Image != "nginx:1.19" {
		t.Errorf("expected image 'nginx:1.19', got %q", d.Image)
	}
	// Labels should include deployment labels and template labels
	if d.Labels["app"] != "nginx" {
		t.Errorf("expected label app=nginx, got %q", d.Labels["app"])
	}
	if d.Labels["tier"] != "frontend" {
		t.Errorf("expected label tier=frontend, got %q", d.Labels["tier"])
	}
	// Template label 'version' should be included
	if d.Labels["version"] != "1.0" {
		t.Errorf("expected label version=1.0, got %q", d.Labels["version"])
	}
}

func TestGetDeployments_NilReplicas(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deploy",
			Namespace: "default",
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: nil, // nil replicas should default to 0
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{{Image: "test:v1"}},
				},
			},
		},
	}

	_, err := clientset.AppsV1().Deployments("default").Create(
		context.Background(), dep, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetDeployments("default")
	if err != nil {
		t.Fatalf("GetDeployments failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 deployment, got %d", len(result))
	}

	if result[0].Replicas != 0 {
		t.Errorf("expected replicas 0 for nil spec.replicas, got %d", result[0].Replicas)
	}
}

func TestGetDeployments_NoContainers(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	int32Ptr := func(i int32) *int32 { return &i }
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "empty-containers",
			Namespace: "default",
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: int32Ptr(1),
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{}, // no containers
				},
			},
		},
	}

	_, err := clientset.AppsV1().Deployments("default").Create(
		context.Background(), dep, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetDeployments("default")
	if err != nil {
		t.Fatalf("GetDeployments failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 deployment, got %d", len(result))
	}

	if result[0].Image != "" {
		t.Errorf("expected empty image for no containers, got %q", result[0].Image)
	}
}

func TestGetDeployments_ListError(t *testing.T) {
	cs := fake.NewSimpleClientset()
	cs.PrependReactor("list", "deployments", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.GetDeployments("default")
	if err == nil {
		t.Fatal("expected error from GetDeployments when list fails")
	}
	if result != nil && len(result) != 0 {
		t.Errorf("expected empty result on list error, got %d", len(result))
	}
}
