package app

import (
	"context"
	"fmt"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
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

func TestGetPodsCountForResource_UnsupportedKind(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}

	_, err := app.GetPodsCountForResource("default", "Widget", "example")
	if err == nil {
		t.Fatal("expected error for unsupported owner kind")
	}
}

func TestGetPodsCountForResource_DetailErrors(t *testing.T) {
	app := &App{
		ctx:           context.Background(),
		testClientset: fake.NewSimpleClientset(),
	}

	tests := []struct {
		name string
		kind string
	}{
		{name: "deployment", kind: "Deployment"},
		{name: "statefulset", kind: "StatefulSet"},
		{name: "job", kind: "Job"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count, err := app.GetPodsCountForResource("default", tt.kind, "missing")
			if err == nil {
				t.Fatalf("expected error for %s detail", tt.kind)
			}
			if count != 0 {
				t.Errorf("expected count 0, got %d", count)
			}
		})
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

func TestGetAllTabCounts_StatefulSetCounts(t *testing.T) {
	ctx := context.Background()
	labels := map[string]string{"app": "db"}
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "db",
				Namespace: "default",
			},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: labels},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "db-0",
				Namespace: "default",
				Labels:    labels,
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "StatefulSet", Name: "db"},
				},
			},
		},
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "db-0",
				Namespace: "default",
			},
		},
	)

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "StatefulSet", "db")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Pods != 1 {
		t.Errorf("expected Pods count 1, got %d", counts.Pods)
	}
	if counts.PVCs != 1 {
		t.Errorf("expected PVCs count 1, got %d", counts.PVCs)
	}
}

func TestGetAllTabCounts_StatefulSetErrors(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	clientset.PrependReactor("list", "persistentvolumeclaims", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pvc list error")
	})

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "StatefulSet", "missing")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Pods != 0 || counts.PVCs != 0 {
		t.Errorf("expected zero counts, got pods=%d pvcs=%d", counts.Pods, counts.PVCs)
	}
}

func TestGetAllTabCounts_ConfigMapCounts(t *testing.T) {
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
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "cm-pod",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name: "config",
						VolumeSource: corev1.VolumeSource{
							ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: "my-config"},
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

	counts, err := app.GetAllTabCounts("default", "ConfigMap", "my-config")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Consumers != 1 {
		t.Errorf("expected Consumers count 1, got %d", counts.Consumers)
	}
	if counts.Data != 1 {
		t.Errorf("expected Data count 1, got %d", counts.Data)
	}
}

func TestGetAllTabCounts_ConfigMapErrors(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	clientset.PrependReactor("list", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pods list error")
	})
	clientset.PrependReactor("get", "configmaps", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated configmap get error")
	})

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "ConfigMap", "my-config")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Consumers != 0 || counts.Data != 0 {
		t.Errorf("expected zero counts, got consumers=%d data=%d", counts.Consumers, counts.Data)
	}
}

func TestGetAllTabCounts_SecretCounts(t *testing.T) {
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
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "secret-pod",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name: "secret",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{SecretName: "my-secret"},
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

	counts, err := app.GetAllTabCounts("default", "Secret", "my-secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Consumers != 1 {
		t.Errorf("expected Consumers count 1, got %d", counts.Consumers)
	}
	if counts.Data != 1 {
		t.Errorf("expected Data count 1, got %d", counts.Data)
	}
}

func TestGetAllTabCounts_SecretErrors(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	clientset.PrependReactor("list", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pods list error")
	})
	clientset.PrependReactor("get", "secrets", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated secret get error")
	})

	app := &App{
		ctx:           ctx,
		testClientset: clientset,
	}

	counts, err := app.GetAllTabCounts("default", "Secret", "my-secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if counts.Consumers != 0 || counts.Data != 0 {
		t.Errorf("expected zero counts, got consumers=%d data=%d", counts.Consumers, counts.Data)
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
