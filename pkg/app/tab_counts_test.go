package app

import (
	"context"
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetResourceEventsCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Event{
			ObjectMeta: metav1.ObjectMeta{Name: "event1", Namespace: "default"},
			InvolvedObject: corev1.ObjectReference{
				Kind: "ConfigMap",
				Name: "my-config",
			},
		},
		&corev1.Event{
			ObjectMeta: metav1.ObjectMeta{Name: "event2", Namespace: "default"},
			InvolvedObject: corev1.ObjectReference{
				Kind: "ConfigMap",
				Name: "my-config",
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetResourceEventsCount("default", "ConfigMap", "my-config")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetResourceEventsCountEmpty(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetResourceEventsCount("default", "ConfigMap", "non-existent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 0 {
		t.Errorf("expected count 0, got %d", count)
	}
}

func TestGetCronJobHistoryCount(t *testing.T) {
	ctx := context.Background()
	cronJobOwner := metav1.OwnerReference{
		Kind: "CronJob",
		Name: "my-cronjob",
	}

	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "my-cronjob-12345",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{cronJobOwner},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "my-cronjob-67890",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{cronJobOwner},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "other-job",
				Namespace: "default",
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetCronJobHistoryCount("default", "my-cronjob")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetServiceEndpointsCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.1"},
						{IP: "10.0.0.2"},
					},
					NotReadyAddresses: []corev1.EndpointAddress{
						{IP: "10.0.0.3"},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetServiceEndpointsCount("default", "my-service")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 3 {
		t.Errorf("expected count 3, got %d", count)
	}
}

func TestGetConfigMapDataCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-config",
				Namespace: "default",
			},
			Data: map[string]string{
				"key1": "value1",
				"key2": "value2",
			},
			BinaryData: map[string][]byte{
				"binary1": []byte("binary"),
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetConfigMapDataCount("default", "my-config")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 3 {
		t.Errorf("expected count 3, got %d", count)
	}
}

func TestGetSecretDataCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-secret",
				Namespace: "default",
			},
			Data: map[string][]byte{
				"username": []byte("admin"),
				"password": []byte("secret"),
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetSecretDataCount("default", "my-secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetIngressRulesCount(t *testing.T) {
	ctx := context.Background()
	pathType := networkingv1.PathTypePrefix
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				Rules: []networkingv1.IngressRule{
					{
						Host: "example.com",
						IngressRuleValue: networkingv1.IngressRuleValue{
							HTTP: &networkingv1.HTTPIngressRuleValue{
								Paths: []networkingv1.HTTPIngressPath{
									{
										Path:     "/api",
										PathType: &pathType,
										Backend: networkingv1.IngressBackend{
											Service: &networkingv1.IngressServiceBackend{
												Name: "api-service",
												Port: networkingv1.ServiceBackendPort{Number: 80},
											},
										},
									},
									{
										Path:     "/web",
										PathType: &pathType,
										Backend: networkingv1.IngressBackend{
											Service: &networkingv1.IngressServiceBackend{
												Name: "web-service",
												Port: networkingv1.ServiceBackendPort{Number: 80},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetIngressRulesCount("default", "my-ingress")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetAllTabCounts(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-config",
				Namespace: "default",
			},
			Data: map[string]string{
				"key1": "value1",
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "ConfigMap", "my-config")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Data != 1 {
		t.Errorf("expected Data count 1, got %d", counts.Data)
	}
}
func TestGetStatefulSetPVCsCount_ByOwnerReference(t *testing.T) {
	ctx := context.Background()
	stsOwner := metav1.OwnerReference{
		Kind: "StatefulSet",
		Name: "my-sts",
	}

	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "data-my-sts-0",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{stsOwner},
			},
		},
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "data-my-sts-1",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{stsOwner},
			},
		},
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "other-pvc",
				Namespace: "default",
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetStatefulSetPVCsCount("default", "my-sts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetStatefulSetPVCsCount_ByNamePrefix(t *testing.T) {
	ctx := context.Background()

	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-sts-data-0",
				Namespace: "default",
			},
		},
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-sts-data-1",
				Namespace: "default",
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetStatefulSetPVCsCount("default", "my-sts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestGetAllTabCounts_Secret(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-secret",
				Namespace: "default",
			},
			Data: map[string][]byte{
				"password": []byte("secret"),
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "Secret", "my-secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Data != 1 {
		t.Errorf("expected Data count 1, got %d", counts.Data)
	}
}

func TestGetAllTabCounts_Service(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.1"},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "Service", "my-service")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Endpoints != 1 {
		t.Errorf("expected Endpoints count 1, got %d", counts.Endpoints)
	}
}

func TestGetAllTabCounts_Ingress(t *testing.T) {
	ctx := context.Background()
	pathType := networkingv1.PathTypePrefix
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				Rules: []networkingv1.IngressRule{
					{
						Host: "example.com",
						IngressRuleValue: networkingv1.IngressRuleValue{
							HTTP: &networkingv1.HTTPIngressRuleValue{
								Paths: []networkingv1.HTTPIngressPath{
									{
										Path:     "/api",
										PathType: &pathType,
									},
								},
							},
						},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "Ingress", "my-ingress")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Rules != 1 {
		t.Errorf("expected Rules count 1, got %d", counts.Rules)
	}
}

func TestGetAllTabCounts_CronJob(t *testing.T) {
	ctx := context.Background()
	cronJobOwner := metav1.OwnerReference{
		Kind: "CronJob",
		Name: "my-cronjob",
	}

	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "my-cronjob-12345",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{cronJobOwner},
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "CronJob", "my-cronjob")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.History != 1 {
		t.Errorf("expected History count 1, got %d", counts.History)
	}
}

func TestGetIngressRulesCount_NoHTTP(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "tcp-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				Rules: []networkingv1.IngressRule{
					{
						Host: "tcp.example.com",
						// No HTTP spec
					},
				},
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	count, err := app.GetIngressRulesCount("default", "tcp-ingress")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Errorf("expected count 1 (rule without HTTP), got %d", count)
	}
}

func TestGetServiceEndpointsCount_NotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	_, err := app.GetServiceEndpointsCount("default", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent service")
	}
}
