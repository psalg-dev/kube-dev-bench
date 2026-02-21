package app

import (
	"context"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// newInformerApp creates an App with a started InformerManager backed by the given clientset.
// The manager is stopped when the test finishes.
func newInformerApp(t *testing.T, clientset *fake.Clientset, namespace string) *App {
	t.Helper()
	app := &App{
		ctx:                context.Background(),
		testClientset:      clientset,
		countsRefreshCh:    make(chan struct{}, 1),
		currentKubeContext: "test",
	}
	manager := NewInformerManager(clientset, []string{namespace}, app)
	if err := manager.Start(); err != nil {
		t.Fatalf("InformerManager.Start() failed: %v", err)
	}
	t.Cleanup(manager.Stop)
	app.informerManager = manager
	return app
}

// ─── GetDeployments informer path ─────────────────────────────────────────────

func TestGetDeploymentsUsesInformerCache(t *testing.T) {
	replicas := int32(2)
	clientset := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{Replicas: &replicas},
		Status:     appsv1.DeploymentStatus{ReadyReplicas: 2},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetDeployments("default")
	if err != nil {
		t.Fatalf("GetDeployments() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 deployment, got %d", len(result))
	}
	if result[0].Name != "web" {
		t.Errorf("expected deployment name 'web', got %q", result[0].Name)
	}
}

// ─── GetStatefulSets informer path ────────────────────────────────────────────

func TestGetStatefulSetsUsesInformerCache(t *testing.T) {
	replicas := int32(1)
	clientset := fake.NewSimpleClientset(&appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
		Spec:       appsv1.StatefulSetSpec{Replicas: &replicas},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetStatefulSets("default")
	if err != nil {
		t.Fatalf("GetStatefulSets() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 statefulset, got %d", len(result))
	}
	if result[0].Name != "db" {
		t.Errorf("expected statefulset name 'db', got %q", result[0].Name)
	}
}

// ─── GetDaemonSets informer path ──────────────────────────────────────────────

func TestGetDaemonSetsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "fluentd", Namespace: "kube-system"},
		Status: appsv1.DaemonSetStatus{
			DesiredNumberScheduled: 3,
			NumberReady:            3,
		},
	})
	app := newInformerApp(t, clientset, "kube-system")
	result, err := app.GetDaemonSets("kube-system")
	if err != nil {
		t.Fatalf("GetDaemonSets() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 daemonset, got %d", len(result))
	}
	if result[0].Name != "fluentd" {
		t.Errorf("expected daemonset name 'fluentd', got %q", result[0].Name)
	}
}

// ─── GetReplicaSets informer path ─────────────────────────────────────────────

func TestGetReplicaSetsUsesInformerCache(t *testing.T) {
	replicas := int32(2)
	clientset := fake.NewSimpleClientset(&appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{Name: "web-rs", Namespace: "default"},
		Spec:       appsv1.ReplicaSetSpec{Replicas: &replicas},
		Status:     appsv1.ReplicaSetStatus{ReadyReplicas: 2},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetReplicaSets("default")
	if err != nil {
		t.Fatalf("GetReplicaSets() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 replicaset, got %d", len(result))
	}
	if result[0].Name != "web-rs" {
		t.Errorf("expected replicaset name 'web-rs', got %q", result[0].Name)
	}
}

// ─── GetCronJobs informer path ────────────────────────────────────────────────

func TestGetCronJobsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "nightly", Namespace: "default"},
		Spec:       batchv1.CronJobSpec{Schedule: "0 0 * * *"},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("GetCronJobs() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 cronjob, got %d", len(result))
	}
	if result[0].Name != "nightly" {
		t.Errorf("expected cronjob name 'nightly', got %q", result[0].Name)
	}
	if result[0].Schedule != "0 0 * * *" {
		t.Errorf("expected schedule '0 0 * * *', got %q", result[0].Schedule)
	}
}

// ─── GetConfigMaps informer path ──────────────────────────────────────────────

func TestGetConfigMapsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "app-config", Namespace: "default"},
		Data:       map[string]string{"key": "value"},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetConfigMaps("default")
	if err != nil {
		t.Fatalf("GetConfigMaps() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 configmap, got %d", len(result))
	}
	if result[0].Name != "app-config" {
		t.Errorf("expected configmap name 'app-config', got %q", result[0].Name)
	}
}

// ─── GetSecrets informer path ─────────────────────────────────────────────────

func TestGetSecretsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "db-creds", Namespace: "default"},
		Type:       corev1.SecretTypeOpaque,
		Data:       map[string][]byte{"password": []byte("secret")},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetSecrets("default")
	if err != nil {
		t.Fatalf("GetSecrets() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 secret, got %d", len(result))
	}
	if name, _ := result[0]["name"].(string); name != "db-creds" {
		t.Errorf("expected secret name 'db-creds', got %q", name)
	}
}

// ─── GetPersistentVolumeClaims informer path ──────────────────────────────────

func TestGetPVCsUsesInformerCache(t *testing.T) {
	storageClass := "standard"
	clientset := fake.NewSimpleClientset(&corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "data-pvc", Namespace: "default"},
		Spec: corev1.PersistentVolumeClaimSpec{
			StorageClassName: &storageClass,
		},
		Status: corev1.PersistentVolumeClaimStatus{Phase: corev1.ClaimBound},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetPersistentVolumeClaims("default")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaims() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 PVC, got %d", len(result))
	}
	if result[0].Name != "data-pvc" {
		t.Errorf("expected PVC name 'data-pvc', got %q", result[0].Name)
	}
}

// ─── GetPodStatusCounts informer path ────────────────────────────────────────

func TestGetPodStatusCountsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-running", Namespace: "default"},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-pending", Namespace: "default"},
			Status:     corev1.PodStatus{Phase: corev1.PodPending},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-failed", Namespace: "default"},
			Status:     corev1.PodStatus{Phase: corev1.PodFailed},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-succeeded", Namespace: "default"},
			Status:     corev1.PodStatus{Phase: corev1.PodSucceeded},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-unknown", Namespace: "default"},
			Status:     corev1.PodStatus{Phase: corev1.PodUnknown},
		},
	)
	app := newInformerApp(t, clientset, "default")
	counts, err := app.GetPodStatusCounts("default")
	if err != nil {
		t.Fatalf("GetPodStatusCounts() error = %v", err)
	}
	if counts.Total != 5 {
		t.Errorf("expected total=5, got %d", counts.Total)
	}
	if counts.Running != 1 {
		t.Errorf("expected running=1, got %d", counts.Running)
	}
	if counts.Pending != 1 {
		t.Errorf("expected pending=1, got %d", counts.Pending)
	}
	if counts.Failed != 1 {
		t.Errorf("expected failed=1, got %d", counts.Failed)
	}
	if counts.Succeeded != 1 {
		t.Errorf("expected succeeded=1, got %d", counts.Succeeded)
	}
	if counts.Unknown != 1 {
		t.Errorf("expected unknown=1, got %d", counts.Unknown)
	}
}

// ─── GetIngresses informer path ───────────────────────────────────────────────

func TestGetIngressesUsesInformerCache(t *testing.T) {
	pathType := networkingv1.PathTypePrefix
	clientset := fake.NewSimpleClientset(&networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "api-ingress", Namespace: "default"},
		Spec: networkingv1.IngressSpec{
			Rules: []networkingv1.IngressRule{{
				Host: "api.example.com",
				IngressRuleValue: networkingv1.IngressRuleValue{
					HTTP: &networkingv1.HTTPIngressRuleValue{
						Paths: []networkingv1.HTTPIngressPath{{
							Path:     "/",
							PathType: &pathType,
							Backend: networkingv1.IngressBackend{
								Service: &networkingv1.IngressServiceBackend{
									Name: "api-svc",
									Port: networkingv1.ServiceBackendPort{Number: 80},
								},
							},
						}},
					},
				},
			}},
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetIngresses("default")
	if err != nil {
		t.Fatalf("GetIngresses() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 ingress, got %d", len(result))
	}
	if result[0].Name != "api-ingress" {
		t.Errorf("expected ingress name 'api-ingress', got %q", result[0].Name)
	}
}

// ─── GetServices informer path ────────────────────────────────────────────────

func TestGetServicesUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "web-svc", Namespace: "default"},
		Spec: corev1.ServiceSpec{
			Type:      corev1.ServiceTypeClusterIP,
			ClusterIP: "10.0.0.1",
			Ports:     []corev1.ServicePort{{Port: 80}},
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetServices("default")
	if err != nil {
		t.Fatalf("GetServices() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 service, got %d", len(result))
	}
	if result[0].Name != "web-svc" {
		t.Errorf("expected service name 'web-svc', got %q", result[0].Name)
	}
}

// ─── getCronJobNextRun ────────────────────────────────────────────────────────

func TestGetCronJobNextRun_Suspended(t *testing.T) {
	suspended := true
	cj := &batchv1.CronJob{
		Spec: batchv1.CronJobSpec{
			Suspend:  &suspended,
			Schedule: "0 0 * * *",
		},
	}
	result := getCronJobNextRun(cj, time.Now())
	if result != "Suspended" {
		t.Errorf("expected 'Suspended', got %q", result)
	}
}

func TestGetCronJobNextRun_InvalidSchedule(t *testing.T) {
	cj := &batchv1.CronJob{
		Spec: batchv1.CronJobSpec{Schedule: "invalid-cron"},
	}
	result := getCronJobNextRun(cj, time.Now())
	if result != "-" {
		t.Errorf("expected '-' for invalid schedule, got %q", result)
	}
}

func TestGetCronJobNextRun_EmptySchedule(t *testing.T) {
	cj := &batchv1.CronJob{
		Spec: batchv1.CronJobSpec{Schedule: ""},
	}
	result := getCronJobNextRun(cj, time.Now())
	if result != "-" {
		t.Errorf("expected '-' for empty schedule, got %q", result)
	}
}
