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

// Tests for GetDaemonSets function
func TestGetDaemonSets(t *testing.T) {
	tests := []struct {
		name       string
		namespace  string
		daemonsets []appsv1.DaemonSet
		expected   int
	}{
		{
			name:       "empty namespace",
			namespace:  "default",
			daemonsets: []appsv1.DaemonSet{},
			expected:   0,
		},
		{
			name:      "single daemonset",
			namespace: "default",
			daemonsets: []appsv1.DaemonSet{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "fluentd",
						Namespace: "default",
						Labels:    map[string]string{"app": "fluentd"},
					},
					Spec: appsv1.DaemonSetSpec{
						Template: v1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{
								Labels: map[string]string{"app": "fluentd"},
							},
							Spec: v1.PodSpec{
								Containers: []v1.Container{
									{Image: "fluentd:v1.14"},
								},
							},
						},
					},
					Status: appsv1.DaemonSetStatus{
						DesiredNumberScheduled: 3,
						NumberReady:            3,
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple daemonsets",
			namespace: "kube-system",
			daemonsets: []appsv1.DaemonSet{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "fluentd", Namespace: "kube-system"},
					Spec: appsv1.DaemonSetSpec{
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "fluentd:v1.14"}},
							},
						},
					},
					Status: appsv1.DaemonSetStatus{DesiredNumberScheduled: 3, NumberReady: 2},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "node-exporter", Namespace: "kube-system"},
					Spec: appsv1.DaemonSetSpec{
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "prom/node-exporter:v1.3"}},
							},
						},
					},
					Status: appsv1.DaemonSetStatus{DesiredNumberScheduled: 3, NumberReady: 3},
				},
			},
			expected: 2,
		},
		{
			name:      "daemonsets in different namespaces",
			namespace: "target-ns",
			daemonsets: []appsv1.DaemonSet{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "app1", Namespace: "target-ns"},
					Spec: appsv1.DaemonSetSpec{
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "app1:v1"}},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "app2", Namespace: "other-ns"},
					Spec: appsv1.DaemonSetSpec{
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
			for _, ds := range tc.daemonsets {
				_, err := clientset.AppsV1().DaemonSets(ds.Namespace).Create(
					context.Background(), &ds, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create daemonset: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetDaemonSets(tc.namespace)
			if err != nil {
				t.Fatalf("GetDaemonSets failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetDaemonSets(%q) returned %d daemonsets, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetDaemonSets_Details(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "fluentd",
			Namespace: "kube-system",
			Labels:    map[string]string{"app": "fluentd", "tier": "logging"},
		},
		Spec: appsv1.DaemonSetSpec{
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": "fluentd", "version": "1.14"},
				},
				Spec: v1.PodSpec{
					Containers: []v1.Container{
						{Image: "fluentd:v1.14"},
					},
				},
			},
		},
		Status: appsv1.DaemonSetStatus{
			DesiredNumberScheduled: 5,
			NumberReady:            4,
		},
	}

	_, err := clientset.AppsV1().DaemonSets("kube-system").Create(
		context.Background(), ds, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create daemonset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetDaemonSets("kube-system")
	if err != nil {
		t.Fatalf("GetDaemonSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 daemonset, got %d", len(result))
	}

	d := result[0]
	if d.Name != "fluentd" {
		t.Errorf("expected name 'fluentd', got %q", d.Name)
	}
	if d.Namespace != "kube-system" {
		t.Errorf("expected namespace 'kube-system', got %q", d.Namespace)
	}
	if d.Desired != 5 {
		t.Errorf("expected desired 5, got %d", d.Desired)
	}
	if d.Current != 4 {
		t.Errorf("expected current 4, got %d", d.Current)
	}
	if d.Image != "fluentd:v1.14" {
		t.Errorf("expected image 'fluentd:v1.14', got %q", d.Image)
	}
	// Labels should include both daemonset and template labels
	if d.Labels["app"] != "fluentd" {
		t.Errorf("expected label app=fluentd, got %q", d.Labels["app"])
	}
	if d.Labels["tier"] != "logging" {
		t.Errorf("expected label tier=logging, got %q", d.Labels["tier"])
	}
	if d.Labels["version"] != "1.14" {
		t.Errorf("expected label version=1.14, got %q", d.Labels["version"])
	}
}

func TestGetDaemonSets_NoContainers(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "empty-containers",
			Namespace: "default",
		},
		Spec: appsv1.DaemonSetSpec{
			Template: v1.PodTemplateSpec{
				Spec: v1.PodSpec{
					Containers: []v1.Container{}, // no containers
				},
			},
		},
	}

	_, err := clientset.AppsV1().DaemonSets("default").Create(
		context.Background(), ds, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create daemonset: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetDaemonSets("default")
	if err != nil {
		t.Fatalf("GetDaemonSets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 daemonset, got %d", len(result))
	}

	if result[0].Image != "" {
		t.Errorf("expected empty image for no containers, got %q", result[0].Image)
	}
}

func TestGetDaemonSets_ListError(t *testing.T) {
	cs := fake.NewSimpleClientset()
	cs.PrependReactor("list", "daemonsets", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	result, err := app.GetDaemonSets("default")
	if err == nil {
		t.Fatal("expected error from GetDaemonSets when list fails")
	}
	if result != nil && len(result) != 0 {
		t.Errorf("expected empty result on list error, got %d", len(result))
	}
}
