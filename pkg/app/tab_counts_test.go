package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
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

func TestGetPodsCountForResource_Deployment(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	_, err := clientset.AppsV1().Deployments("default").Create(ctx, &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "d1", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "d1"}},
			Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "d1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}
	_, err = clientset.CoreV1().Pods("default").Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default", Labels: map[string]string{"app": "d1"}},
		Status:     corev1.PodStatus{Phase: corev1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetPodsCountForResource("default", "Deployment", "d1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 pod, got %d", count)
	}
}

func TestGetPodsCountForResource_UnsupportedKind(t *testing.T) {
	app := &App{}
	_, err := app.GetPodsCountForResource("default", "Unknown", "name")
	if err == nil {
		t.Fatalf("expected error for unsupported kind")
	}
}

func TestGetPodsCountForResource_StatefulSet(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	_, err := clientset.AppsV1().StatefulSets("default").Create(ctx, &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "ss1", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: "svc",
			Selector:    &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ss1"}},
			Template:    corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ss1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}
	_, err = clientset.CoreV1().Pods("default").Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "p1",
			Namespace: "default",
			Labels:    map[string]string{"app": "ss1"},
			OwnerReferences: []metav1.OwnerReference{{
				Kind: "StatefulSet",
				Name: "ss1",
			}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetPodsCountForResource("default", "StatefulSet", "ss1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 pod, got %d", count)
	}
}

func TestGetPodsCountForResource_DaemonSet(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	_, err := clientset.AppsV1().DaemonSets("default").Create(ctx, &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds1"}},
			Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ds1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create daemonset: %v", err)
	}
	_, err = clientset.CoreV1().Pods("default").Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "p1",
			Namespace: "default",
			Labels:    map[string]string{"app": "ds1"},
			OwnerReferences: []metav1.OwnerReference{{
				Kind: "DaemonSet",
				Name: "ds1",
			}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetPodsCountForResource("default", "DaemonSet", "ds1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 pod, got %d", count)
	}
}

func TestGetPodsCountForResource_ReplicaSet(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	_, err := clientset.AppsV1().ReplicaSets("default").Create(ctx, &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{Name: "rs1", Namespace: "default"},
		Spec: appsv1.ReplicaSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "rs1"}},
			Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "rs1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create replicaset: %v", err)
	}
	_, err = clientset.CoreV1().Pods("default").Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "p1",
			Namespace: "default",
			Labels:    map[string]string{"app": "rs1"},
			OwnerReferences: []metav1.OwnerReference{{
				Kind: "ReplicaSet",
				Name: "rs1",
			}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetPodsCountForResource("default", "ReplicaSet", "rs1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 pod, got %d", count)
	}
}

func TestGetPodsCountForResource_Job(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	selector := map[string]string{"job": "j1"}
	_, err := clientset.BatchV1().Jobs("default").Create(ctx, &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "j1", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Selector: &metav1.LabelSelector{MatchLabels: selector},
			Template: corev1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: selector}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create job: %v", err)
	}
	_, err = clientset.CoreV1().Pods("default").Create(ctx, &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "p1",
			Namespace: "default",
			Labels:    selector,
			OwnerReferences: []metav1.OwnerReference{{
				Kind: "Job",
				Name: "j1",
			}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetPodsCountForResource("default", "Job", "j1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 pod, got %d", count)
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

func TestGetConfigMapConsumersCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
			Spec: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name:  "c",
					Image: "busybox",
					EnvFrom: []corev1.EnvFromSource{{
						ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}},
					}},
				}},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetConfigMapConsumersCount("default", "cm1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 consumer, got %d", count)
	}
}

func TestGetSecretConsumersCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{{
					Name:         "sec",
					VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: "s1"}},
				}},
				Containers: []corev1.Container{{Name: "c"}},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetSecretConsumersCount("default", "s1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 consumer, got %d", count)
	}
}

func TestGetPVCConsumersCount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{{
					Name: "data",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "pvc1"},
					},
				}},
				Containers: []corev1.Container{{Name: "c"}},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}
	count, err := app.GetPVCConsumersCount("default", "pvc1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 consumer, got %d", count)
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
