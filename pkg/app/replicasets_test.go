package app

import (
	"context"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetReplicaSets function
func TestGetReplicaSets(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	tests := []struct {
		name        string
		namespace   string
		replicasets []appsv1.ReplicaSet
		expected    int
	}{
		{
			name:        "empty namespace",
			namespace:   "default",
			replicasets: []appsv1.ReplicaSet{},
			expected:    0,
		},
		{
			name:      "single replicaset",
			namespace: "default",
			replicasets: []appsv1.ReplicaSet{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "nginx-abc123",
						Namespace: "default",
						Labels:    map[string]string{"app": "nginx"},
					},
					Spec: appsv1.ReplicaSetSpec{
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
					Status: appsv1.ReplicaSetStatus{
						ReadyReplicas: 2,
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple replicasets",
			namespace: "default",
			replicasets: []appsv1.ReplicaSet{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "nginx-abc", Namespace: "default"},
					Spec: appsv1.ReplicaSetSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "nginx:1.0"}},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "nginx-def", Namespace: "default"},
					Spec: appsv1.ReplicaSetSpec{
						Replicas: int32Ptr(2),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "nginx:2.0"}},
							},
						},
					},
				},
			},
			expected: 2,
		},
		{
			name:      "replicasets in different namespaces",
			namespace: "target-ns",
			replicasets: []appsv1.ReplicaSet{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "app1", Namespace: "target-ns"},
					Spec: appsv1.ReplicaSetSpec{
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
					Spec: appsv1.ReplicaSetSpec{
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
			for _, rs := range tc.replicasets {
				_, err := clientset.AppsV1().ReplicaSets(rs.Namespace).Create(
					context.Background(), &rs, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create replicaset: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetReplicaSets(tc.namespace)
			if err != nil {
				t.Fatalf("GetReplicaSets failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetReplicaSets(%q) returned %d replicasets, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetReplicaSets_Details(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	clientset := fake.NewSimpleClientset()
	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "nginx-abc123",
			Namespace: "default",
			Labels:    map[string]string{"app": "nginx", "pod-template-hash": "abc123"},
		},
		Spec: appsv1.ReplicaSetSpec{
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
		Status: appsv1.ReplicaSetStatus{
			ReadyReplicas: 4,
		},
	}

	_, err := clientset.AppsV1().ReplicaSets("default").Create(
		context.Background(), rs, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create replicaset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetReplicaSets("default")
	if err != nil {
		t.Fatalf("GetReplicaSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 replicaset, got %d", len(result))
	}

	r := result[0]
	if r.Name != "nginx-abc123" {
		t.Errorf("expected name 'nginx-abc123', got %q", r.Name)
	}
	if r.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", r.Namespace)
	}
	if r.Replicas != 5 {
		t.Errorf("expected replicas 5, got %d", r.Replicas)
	}
	if r.Ready != 4 {
		t.Errorf("expected ready 4, got %d", r.Ready)
	}
	if r.Image != "nginx:1.19" {
		t.Errorf("expected image 'nginx:1.19', got %q", r.Image)
	}
	// Labels should include both replicaset and template labels
	if r.Labels["app"] != "nginx" {
		t.Errorf("expected label app=nginx, got %q", r.Labels["app"])
	}
	if r.Labels["pod-template-hash"] != "abc123" {
		t.Errorf("expected label pod-template-hash=abc123, got %q", r.Labels["pod-template-hash"])
	}
	if r.Labels["version"] != "1.0" {
		t.Errorf("expected label version=1.0, got %q", r.Labels["version"])
	}
}

func TestStartReplicaSetPolling_ListActions(t *testing.T) {
	disableWailsEvents = true

	clientset := fake.NewSimpleClientset(&appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{Name: "rs-1", Namespace: "default"},
		Spec: appsv1.ReplicaSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "x"}},
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "x"}},
				Spec:       v1.PodSpec{},
			},
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app := &App{
		ctx:              ctx,
		currentNamespace: "default",
		testClientset:    clientset,
	}

	app.StartReplicaSetPolling()
	start := time.Now()
	for time.Since(start) < 1500*time.Millisecond {
		if hasListAction(clientset.Actions(), "replicasets") {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	cancel()

	if !hasListAction(clientset.Actions(), "replicasets") {
		t.Fatalf("expected replicasets list action")
	}
}

func TestGetReplicaSets_NilReplicas(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-rs",
			Namespace: "default",
		},
		Spec: appsv1.ReplicaSetSpec{
			Replicas: nil, // nil replicas should default to 0
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{{Image: "test:v1"}},
				},
			},
		},
	}

	_, err := clientset.AppsV1().ReplicaSets("default").Create(
		context.Background(), rs, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create replicaset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetReplicaSets("default")
	if err != nil {
		t.Fatalf("GetReplicaSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 replicaset, got %d", len(result))
	}

	if result[0].Replicas != 0 {
		t.Errorf("expected replicas 0 for nil spec.replicas, got %d", result[0].Replicas)
	}
}

func TestGetReplicaSets_NoContainers(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }
	clientset := fake.NewSimpleClientset()
	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "empty-containers",
			Namespace: "default",
		},
		Spec: appsv1.ReplicaSetSpec{
			Replicas: int32Ptr(1),
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{}, // no containers
				},
			},
		},
	}

	_, err := clientset.AppsV1().ReplicaSets("default").Create(
		context.Background(), rs, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create replicaset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetReplicaSets("default")
	if err != nil {
		t.Fatalf("GetReplicaSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 replicaset, got %d", len(result))
	}

	if result[0].Image != "" {
		t.Errorf("expected empty image for no containers, got %q", result[0].Image)
	}
}
