package app

import (
	"context"
	"testing"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetIngresses function
func TestGetIngresses(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		ingresses []networkingv1.Ingress
		expected  int
	}{
		{
			name:      "empty namespace",
			namespace: "default",
			ingresses: []networkingv1.Ingress{},
			expected:  0,
		},
		{
			name:      "single ingress",
			namespace: "default",
			ingresses: []networkingv1.Ingress{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "my-ingress",
						Namespace: "default",
						Labels:    map[string]string{"app": "web"},
					},
					Spec: networkingv1.IngressSpec{
						Rules: []networkingv1.IngressRule{
							{Host: "example.com"},
						},
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple ingresses",
			namespace: "default",
			ingresses: []networkingv1.Ingress{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "ingress-1", Namespace: "default"},
					Spec: networkingv1.IngressSpec{
						Rules: []networkingv1.IngressRule{{Host: "app1.example.com"}},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "ingress-2", Namespace: "default"},
					Spec: networkingv1.IngressSpec{
						Rules: []networkingv1.IngressRule{{Host: "app2.example.com"}},
					},
				},
			},
			expected: 2,
		},
		{
			name:      "ingresses in different namespaces",
			namespace: "target-ns",
			ingresses: []networkingv1.Ingress{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "ing-1", Namespace: "target-ns"},
					Spec: networkingv1.IngressSpec{
						Rules: []networkingv1.IngressRule{{Host: "app1.example.com"}},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "ing-2", Namespace: "other-ns"},
					Spec: networkingv1.IngressSpec{
						Rules: []networkingv1.IngressRule{{Host: "app2.example.com"}},
					},
				},
			},
			expected: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, ing := range tc.ingresses {
				_, err := clientset.NetworkingV1().Ingresses(ing.Namespace).Create(
					context.Background(), &ing, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create ingress: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetIngresses(tc.namespace)
			if err != nil {
				t.Fatalf("GetIngresses failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetIngresses(%q) returned %d ingresses, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetIngresses_Details(t *testing.T) {
	ingressClassName := "nginx"
	clientset := fake.NewSimpleClientset()
	ing := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-ingress",
			Namespace: "default",
			Labels:    map[string]string{"app": "web", "tier": "frontend"},
		},
		Spec: networkingv1.IngressSpec{
			IngressClassName: &ingressClassName,
			Rules: []networkingv1.IngressRule{
				{Host: "app.example.com"},
				{Host: "www.example.com"},
			},
			TLS: []networkingv1.IngressTLS{
				{Hosts: []string{"app.example.com"}, SecretName: "tls-secret"},
			},
		},
		Status: networkingv1.IngressStatus{
			LoadBalancer: networkingv1.IngressLoadBalancerStatus{
				Ingress: []networkingv1.IngressLoadBalancerIngress{
					{IP: "192.168.1.100"},
				},
			},
		},
	}

	_, err := clientset.NetworkingV1().Ingresses("default").Create(
		context.Background(), ing, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create ingress: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetIngresses("default")
	if err != nil {
		t.Fatalf("GetIngresses failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 ingress, got %d", len(result))
	}

	i := result[0]
	if i.Name != "web-ingress" {
		t.Errorf("expected name 'web-ingress', got %q", i.Name)
	}
	if i.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", i.Namespace)
	}
	if i.Class != "nginx" {
		t.Errorf("expected class 'nginx', got %q", i.Class)
	}
	if len(i.Hosts) != 2 {
		t.Errorf("expected 2 hosts, got %d", len(i.Hosts))
	}
	if i.Address != "192.168.1.100" {
		t.Errorf("expected address '192.168.1.100', got %q", i.Address)
	}
	// Check labels
	if i.Labels["app"] != "web" {
		t.Errorf("expected label app=web, got %q", i.Labels["app"])
	}
	if i.Labels["tier"] != "frontend" {
		t.Errorf("expected label tier=frontend, got %q", i.Labels["tier"])
	}
}

func TestGetIngresses_IngressClassAnnotation(t *testing.T) {
	// Test ingress class from annotation (legacy way)
	clientset := fake.NewSimpleClientset()
	ing := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "legacy-ingress",
			Namespace: "default",
			Annotations: map[string]string{
				"kubernetes.io/ingress.class": "traefik",
			},
		},
		Spec: networkingv1.IngressSpec{
			Rules: []networkingv1.IngressRule{
				{Host: "legacy.example.com"},
			},
		},
	}

	_, err := clientset.NetworkingV1().Ingresses("default").Create(
		context.Background(), ing, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create ingress: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetIngresses("default")
	if err != nil {
		t.Fatalf("GetIngresses failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 ingress, got %d", len(result))
	}

	if result[0].Class != "traefik" {
		t.Errorf("expected class 'traefik' from annotation, got %q", result[0].Class)
	}
}

func TestGetIngresses_MultipleHosts(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	ing := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "multi-host",
			Namespace: "default",
		},
		Spec: networkingv1.IngressSpec{
			Rules: []networkingv1.IngressRule{
				{Host: "api.example.com"},
				{Host: "web.example.com"},
				{Host: "admin.example.com"},
			},
		},
	}

	_, err := clientset.NetworkingV1().Ingresses("default").Create(
		context.Background(), ing, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create ingress: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetIngresses("default")
	if err != nil {
		t.Fatalf("GetIngresses failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 ingress, got %d", len(result))
	}

	if len(result[0].Hosts) != 3 {
		t.Errorf("expected 3 hosts, got %d", len(result[0].Hosts))
	}
}
