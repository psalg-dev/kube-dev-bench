package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetServices_ReturnsServices(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeClusterIP,
				ClusterIP: "10.0.0.1",
				Ports: []corev1.ServicePort{
					{Port: 80, Protocol: corev1.ProtocolTCP, Name: "http"},
				},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "api",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeLoadBalancer,
				ClusterIP: "10.0.0.2",
				Ports: []corev1.ServicePort{
					{Port: 443, Protocol: corev1.ProtocolTCP},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	services, err := app.GetServices("default")
	if err != nil {
		t.Fatalf("GetServices failed: %v", err)
	}

	if len(services) != 2 {
		t.Fatalf("expected 2 services, got %d", len(services))
	}
}

func TestGetServices_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServices("")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetServices_NoServices(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	services, err := app.GetServices("default")
	if err != nil {
		t.Fatalf("GetServices failed: %v", err)
	}

	if len(services) != 0 {
		t.Errorf("expected 0 services, got %d", len(services))
	}
}

func TestGetServices_WithLabels(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
				Labels: map[string]string{
					"app":  "web",
					"tier": "frontend",
				},
			},
			Spec: corev1.ServiceSpec{
				Type: corev1.ServiceTypeClusterIP,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	services, err := app.GetServices("default")
	if err != nil {
		t.Fatalf("GetServices failed: %v", err)
	}

	if len(services) != 1 {
		t.Fatalf("expected 1 service, got %d", len(services))
	}

	if services[0].Labels["app"] != "web" {
		t.Errorf("expected label app=web, got %s", services[0].Labels["app"])
	}
}

func TestGetServiceEndpoints_ReturnsEndpoints(t *testing.T) {
	ctx := context.Background()
	nodeName := "node-1"
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{
					{Port: 80, Protocol: corev1.ProtocolTCP},
				},
			},
		},
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{
							IP:       "10.0.0.1",
							NodeName: &nodeName,
							TargetRef: &corev1.ObjectReference{
								Kind: "Pod",
								Name: "web-abc123",
							},
						},
					},
					Ports: []corev1.EndpointPort{
						{Port: 8080, Protocol: corev1.ProtocolTCP},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	endpoints, err := app.GetServiceEndpoints("default", "web")
	if err != nil {
		t.Fatalf("GetServiceEndpoints failed: %v", err)
	}

	if len(endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(endpoints))
	}

	ep := endpoints[0]
	if ep.IP != "10.0.0.1" {
		t.Errorf("expected IP 10.0.0.1, got %s", ep.IP)
	}
	if ep.PodName != "web-abc123" {
		t.Errorf("expected pod name web-abc123, got %s", ep.PodName)
	}
	if ep.NodeName != "node-1" {
		t.Errorf("expected node name node-1, got %s", ep.NodeName)
	}
	if !ep.Ready {
		t.Error("expected endpoint to be ready")
	}
}

func TestGetServiceEndpoints_IncludesNotReadyAddresses(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{
					{Port: 80, Protocol: corev1.ProtocolTCP},
				},
			},
		},
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.1"},
					},
					NotReadyAddresses: []corev1.EndpointAddress{
						{IP: "10.0.0.2"},
					},
					Ports: []corev1.EndpointPort{
						{Port: 8080, Protocol: corev1.ProtocolTCP},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	endpoints, err := app.GetServiceEndpoints("default", "web")
	if err != nil {
		t.Fatalf("GetServiceEndpoints failed: %v", err)
	}

	if len(endpoints) != 2 {
		t.Fatalf("expected 2 endpoints (ready + not ready), got %d", len(endpoints))
	}

	readyCount := 0
	for _, ep := range endpoints {
		if ep.Ready {
			readyCount++
		}
	}
	if readyCount != 1 {
		t.Errorf("expected 1 ready endpoint, got %d", readyCount)
	}
}

func TestGetServiceEndpoints_EmptyParams(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServiceEndpoints("", "web")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	_, err = app.GetServiceEndpoints("default", "")
	if err == nil {
		t.Fatal("expected error for empty service name")
	}
}

func TestGetServiceEndpoints_ServiceNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetServiceEndpoints("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent service")
	}
}

func TestGetServiceSummary_ReturnsInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeLoadBalancer,
				ClusterIP: "10.0.0.1",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	summary, err := app.GetServiceSummary("default", "web")
	if err != nil {
		t.Fatalf("GetServiceSummary failed: %v", err)
	}

	if summary.Name != "web" {
		t.Errorf("expected name web, got %s", summary.Name)
	}
	if summary.Type != "LoadBalancer" {
		t.Errorf("expected type LoadBalancer, got %s", summary.Type)
	}
	if summary.ClusterIP != "10.0.0.1" {
		t.Errorf("expected ClusterIP 10.0.0.1, got %s", summary.ClusterIP)
	}
}

func TestGetServiceSummary_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServiceSummary("", "web")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetServiceSummary_EmptyServiceName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServiceSummary("default", "")
	if err == nil {
		t.Fatal("expected error for empty service name")
	}
}

func TestGetServiceSummary_NotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetServiceSummary("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent service")
	}
}
