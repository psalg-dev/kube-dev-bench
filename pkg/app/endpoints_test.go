package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetEndpoints_ReturnsEndpoints(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
				Labels: map[string]string{
					"app": "myapp",
				},
				Annotations: map[string]string{
					"description": "test endpoint",
				},
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.1"},
						{IP: "10.0.0.2"},
					},
					Ports: []corev1.EndpointPort{
						{Port: 8080},
					},
				},
			},
		},
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "another-service",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	endpoints, err := app.GetEndpoints("default")
	if err != nil {
		t.Fatalf("GetEndpoints failed: %v", err)
	}

	if len(endpoints) != 2 {
		t.Fatalf("expected 2 endpoints, got %d", len(endpoints))
	}

	// Find the endpoint by name
	var myService *EndpointInfo
	for i := range endpoints {
		if endpoints[i].Name == "my-service" {
			myService = &endpoints[i]
			break
		}
	}

	if myService == nil {
		t.Fatal("expected to find endpoint 'my-service'")
	}

	// Verify endpoint details
	if myService.Namespace != "default" {
		t.Errorf("expected namespace 'default', got '%s'", myService.Namespace)
	}
	if len(myService.Endpoints) != 2 {
		t.Errorf("expected 2 endpoint addresses, got %d", len(myService.Endpoints))
	}
	if myService.Labels["app"] != "myapp" {
		t.Errorf("expected label app=myapp, got %v", myService.Labels)
	}
}

func TestGetEndpoints_NoEndpoints(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	endpoints, err := app.GetEndpoints("default")
	if err != nil {
		t.Fatalf("GetEndpoints failed: %v", err)
	}

	if len(endpoints) != 0 {
		t.Errorf("expected 0 endpoints, got %d", len(endpoints))
	}
}

func TestGetEndpoints_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetEndpoints("")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetEndpointDetail_ReturnsEndpoint(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
				Labels: map[string]string{
					"app": "myapp",
				},
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.1"},
					},
					Ports: []corev1.EndpointPort{
						{Port: 8080},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	endpoint, err := app.GetEndpointDetail("default", "my-service")
	if err != nil {
		t.Fatalf("GetEndpointDetail failed: %v", err)
	}

	if endpoint.Name != "my-service" {
		t.Errorf("expected endpoint name 'my-service', got '%s'", endpoint.Name)
	}
	if len(endpoint.Endpoints) != 1 {
		t.Errorf("expected 1 endpoint address, got %d", len(endpoint.Endpoints))
	}
}

func TestGetEndpointDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetEndpointDetail("", "my-service")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetEndpointDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetEndpointDetail("default", "")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestBuildEndpointInfo_MultiplePortsAndAddresses(t *testing.T) {
	endpoint := &corev1.Endpoints{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "multi-endpoint",
			Namespace: "default",
		},
		Subsets: []corev1.EndpointSubset{
			{
				Addresses: []corev1.EndpointAddress{
					{IP: "10.0.0.1"},
					{IP: "10.0.0.2"},
				},
				Ports: []corev1.EndpointPort{
					{Port: 8080},
					{Port: 9090},
				},
			},
		},
	}

	info := buildEndpointInfo(endpoint, metav1.Now().Time)

	expectedAddresses := 4 // 2 IPs * 2 ports
	if len(info.Endpoints) != expectedAddresses {
		t.Errorf("expected %d endpoint addresses, got %d", expectedAddresses, len(info.Endpoints))
	}
}
