package app

import (
	"context"
	"strings"
	"testing"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ---------------------------------------------------------------------------
// TestGetServiceYAML
// ---------------------------------------------------------------------------

func TestGetServiceYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Services(ns).Create(ctx, &corev1.Service{
		TypeMeta:   metav1.TypeMeta{Kind: "Service", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-svc", Namespace: ns},
		Spec:       corev1.ServiceSpec{ClusterIP: "10.0.0.1"},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetServiceYAML(ns, "my-svc")
	if err != nil {
		t.Fatalf("GetServiceYAML: %v", err)
	}
	if !strings.Contains(y, "my-svc") {
		t.Errorf("expected service name in YAML, got: %s", y)
	}
}

func TestGetServiceYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetServiceYAML("", "svc")
	if err == nil || !strings.Contains(err.Error(), "namespace required") {
		t.Fatalf("expected namespace-required error, got: %v", err)
	}
}

func TestGetServiceYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetServiceYAML("default", "no-such-svc")
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
}

// ---------------------------------------------------------------------------
// TestGetIngressYAML
// ---------------------------------------------------------------------------

func TestGetIngressYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.NetworkingV1().Ingresses(ns).Create(ctx, &networkingv1.Ingress{
		TypeMeta:   metav1.TypeMeta{Kind: "Ingress", APIVersion: "networking.k8s.io/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-ing", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetIngressYAML(ns, "my-ing")
	if err != nil {
		t.Fatalf("GetIngressYAML: %v", err)
	}
	if !strings.Contains(y, "my-ing") {
		t.Errorf("expected ingress name in YAML, got: %s", y)
	}
}

func TestGetIngressYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetIngressYAML("", "ing")
	if err == nil || !strings.Contains(err.Error(), "namespace required") {
		t.Fatalf("expected namespace-required error, got: %v", err)
	}
}

func TestGetIngressYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetIngressYAML("default", "no-such-ing")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetJobYAML
// ---------------------------------------------------------------------------

func TestGetJobYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.BatchV1().Jobs(ns).Create(ctx, &batchv1.Job{
		TypeMeta:   metav1.TypeMeta{Kind: "Job", APIVersion: "batch/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-job", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetJobYAML(ns, "my-job")
	if err != nil {
		t.Fatalf("GetJobYAML: %v", err)
	}
	if !strings.Contains(y, "my-job") {
		t.Errorf("expected job name in YAML, got: %s", y)
	}
}

func TestGetJobYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetJobYAML("", "job")
	if err == nil || !strings.Contains(err.Error(), "namespace required") {
		t.Fatalf("expected namespace-required error, got: %v", err)
	}
}

func TestGetJobYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetJobYAML("default", "no-such-job")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetCronJobYAML
// ---------------------------------------------------------------------------

func TestGetCronJobYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.BatchV1().CronJobs(ns).Create(ctx, &batchv1.CronJob{
		TypeMeta:   metav1.TypeMeta{Kind: "CronJob", APIVersion: "batch/v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-cron", Namespace: ns},
		Spec:       batchv1.CronJobSpec{Schedule: "*/5 * * * *"},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetCronJobYAML(ns, "my-cron")
	if err != nil {
		t.Fatalf("GetCronJobYAML: %v", err)
	}
	if !strings.Contains(y, "my-cron") {
		t.Errorf("expected cronjob name in YAML, got: %s", y)
	}
}

func TestGetCronJobYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetCronJobYAML("", "cj")
	if err == nil || !strings.Contains(err.Error(), "namespace required") {
		t.Fatalf("expected namespace-required error, got: %v", err)
	}
}

func TestGetCronJobYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetCronJobYAML("default", "no-cron")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetSecretYAML
// ---------------------------------------------------------------------------

func TestGetSecretYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Secrets(ns).Create(ctx, &corev1.Secret{
		TypeMeta:   metav1.TypeMeta{Kind: "Secret", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-secret", Namespace: ns},
		Type:       corev1.SecretTypeOpaque,
		Data:       map[string][]byte{"key": []byte("value")},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetSecretYAML(ns, "my-secret")
	if err != nil {
		t.Fatalf("GetSecretYAML: %v", err)
	}
	if !strings.Contains(y, "my-secret") {
		t.Errorf("expected secret name in YAML, got: %s", y)
	}
}

func TestGetSecretYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetSecretYAML("", "secret")
	if err == nil || !strings.Contains(err.Error(), "namespace required") {
		t.Fatalf("expected namespace-required error, got: %v", err)
	}
}

func TestGetSecretYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetSecretYAML("default", "no-secret")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetPersistentVolumeYAML
// ---------------------------------------------------------------------------

func TestGetPersistentVolumeYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().PersistentVolumes().Create(ctx, &corev1.PersistentVolume{
		TypeMeta:   metav1.TypeMeta{Kind: "PersistentVolume", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-pv"},
		Spec: corev1.PersistentVolumeSpec{
			Capacity: corev1.ResourceList{
				corev1.ResourceStorage: resource.MustParse("10Gi"),
			},
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
		},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetPersistentVolumeYAML("my-pv")
	if err != nil {
		t.Fatalf("GetPersistentVolumeYAML: %v", err)
	}
	if !strings.Contains(y, "my-pv") {
		t.Errorf("expected PV name in YAML, got: %s", y)
	}
}

func TestGetPersistentVolumeYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetPersistentVolumeYAML("no-such-pv")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetPersistentVolumeClaimYAML
// ---------------------------------------------------------------------------

func TestGetPersistentVolumeClaimYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().PersistentVolumeClaims(ns).Create(ctx, &corev1.PersistentVolumeClaim{
		TypeMeta:   metav1.TypeMeta{Kind: "PersistentVolumeClaim", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-pvc", Namespace: ns},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
		},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	y, err := app.GetPersistentVolumeClaimYAML(ns, "my-pvc")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaimYAML: %v", err)
	}
	if !strings.Contains(y, "my-pvc") {
		t.Errorf("expected PVC name in YAML, got: %s", y)
	}
}

func TestGetPersistentVolumeClaimYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetPersistentVolumeClaimYAML("", "pvc")
	if err == nil || !strings.Contains(err.Error(), "namespace required") {
		t.Fatalf("expected namespace-required error, got: %v", err)
	}
}

func TestGetPersistentVolumeClaimYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.GetPersistentVolumeClaimYAML("default", "no-pvc")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetHorizontalPodAutoscalerYAML  (tested via GetResourceYAML "hpa" switch)
// ---------------------------------------------------------------------------

func TestGetHorizontalPodAutoscalerYAML_HappyPath(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	minReplicas := int32(1)
	_, _ = cs.AutoscalingV2().HorizontalPodAutoscalers(ns).Create(ctx, &autoscalingv2.HorizontalPodAutoscaler{
		TypeMeta:   metav1.TypeMeta{Kind: "HorizontalPodAutoscaler", APIVersion: "autoscaling/v2"},
		ObjectMeta: metav1.ObjectMeta{Name: "my-hpa", Namespace: ns},
		Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
			ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
				APIVersion: "apps/v1",
				Kind:       "Deployment",
				Name:       "my-deploy",
			},
			MinReplicas: &minReplicas,
			MaxReplicas: 10,
		},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	// Test via GetResourceYAML which routes to getHorizontalPodAutoscalerYAML
	y, err := app.GetResourceYAML("hpa", ns, "my-hpa")
	if err != nil {
		t.Fatalf("GetResourceYAML hpa: %v", err)
	}
	if !strings.Contains(y, "my-hpa") {
		t.Errorf("expected HPA name in YAML, got: %s", y)
	}
}

func TestGetHorizontalPodAutoscalerYAML_EmptyNamespace(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	app.currentNamespace = ""
	_, err := app.GetResourceYAML("hpa", "", "my-hpa")
	if err == nil {
		t.Fatal("expected error for empty namespace, got nil")
	}
}

func TestGetHorizontalPodAutoscalerYAML_NotFound(t *testing.T) {
	app := newTestAppWithClientset(fake.NewSimpleClientset())
	_, err := app.getHorizontalPodAutoscalerYAML("default", "no-hpa")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ---------------------------------------------------------------------------
// TestGetResourceYAML_AdditionalKinds – covers uncovered switch branches
// ---------------------------------------------------------------------------

func TestGetResourceYAML_ServiceKind(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Services(ns).Create(ctx, &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "testsvc", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("service", ns, "testsvc")
	if err != nil {
		t.Fatalf("GetResourceYAML service: %v", err)
	}
	if !strings.Contains(y, "testsvc") {
		t.Errorf("expected svc name in YAML: %s", y)
	}
}

func TestGetResourceYAML_SvcAlias(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Services(ns).Create(ctx, &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "svcalias", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("svc", ns, "svcalias")
	if err != nil {
		t.Fatalf("GetResourceYAML svc alias: %v", err)
	}
	if !strings.Contains(y, "svcalias") {
		t.Errorf("expected svc name in YAML: %s", y)
	}
}

func TestGetResourceYAML_IngressKind(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.NetworkingV1().Ingresses(ns).Create(ctx, &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ing", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("ingress", ns, "test-ing")
	if err != nil {
		t.Fatalf("GetResourceYAML ingress: %v", err)
	}
	if !strings.Contains(y, "test-ing") {
		t.Errorf("expected ingress name: %s", y)
	}
}

func TestGetResourceYAML_JobKind(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.BatchV1().Jobs(ns).Create(ctx, &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job2", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("job", ns, "test-job2")
	if err != nil {
		t.Fatalf("GetResourceYAML job: %v", err)
	}
	if !strings.Contains(y, "test-job2") {
		t.Errorf("expected job name: %s", y)
	}
}

func TestGetResourceYAML_CronJobKind(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.BatchV1().CronJobs(ns).Create(ctx, &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "test-cron2", Namespace: ns},
		Spec:       batchv1.CronJobSpec{Schedule: "0 * * * *"},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("cronjob", ns, "test-cron2")
	if err != nil {
		t.Fatalf("GetResourceYAML cronjob: %v", err)
	}
	if !strings.Contains(y, "test-cron2") {
		t.Errorf("expected cronjob name: %s", y)
	}
}

func TestGetResourceYAML_SecretKind(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Secrets(ns).Create(ctx, &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "test-secret2", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("secret", ns, "test-secret2")
	if err != nil {
		t.Fatalf("GetResourceYAML secret: %v", err)
	}
	if !strings.Contains(y, "test-secret2") {
		t.Errorf("expected secret name: %s", y)
	}
}

func TestGetResourceYAML_PVCKind(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().PersistentVolumeClaims(ns).Create(ctx, &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pvc2", Namespace: ns},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)
	app.currentNamespace = ns

	y, err := app.GetResourceYAML("pvc", ns, "test-pvc2")
	if err != nil {
		t.Fatalf("GetResourceYAML pvc: %v", err)
	}
	if !strings.Contains(y, "test-pvc2") {
		t.Errorf("expected PVC name: %s", y)
	}
}

func TestGetResourceYAML_PVKind(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().PersistentVolumes().Create(ctx, &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pv2"},
	}, metav1.CreateOptions{})
	app := newTestAppWithClientset(cs)

	y, err := app.GetResourceYAML("pv", "", "test-pv2")
	if err != nil {
		t.Fatalf("GetResourceYAML pv: %v", err)
	}
	if !strings.Contains(y, "test-pv2") {
		t.Errorf("expected PV name: %s", y)
	}
}
