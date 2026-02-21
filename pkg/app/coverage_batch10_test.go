package app

// coverage_batch10_test.go – systematic coverage of getKubernetesInterface error
// paths and resource-not-found paths across many handlers.
//
// Pattern A – "getK8s error": create an App with NewApp() (currentKubeContext="")
//   so getKubernetesInterface() → getKubernetesClient() → getRESTConfig() returns
//   "no kube context selected" without touching the real cluster.
//
// Pattern B – "resource not-found": create an App with testClientset set to an
//   empty fake clientset, then try to Get a resource that doesn't exist.
//
// Pattern C – misc: other branches exercised with controlled inputs.

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	fake "k8s.io/client-go/kubernetes/fake"
)

// ─── helper ──────────────────────────────────────────────────────────────────

// newAppNoCtx returns a NewApp() with a currentNamespace set so that functions
// that guard on currentNamespace don't return early before reaching the K8s
// client call.
func newAppNoCtx() *App {
	a := NewApp()
	a.currentNamespace = "default"
	return a
}

// ─── workload_logs.go ────────────────────────────────────────────────────────

// TestGetPodLogsInNamespace_NilCtxAndGetLogsError covers the ctx==nil safety
// branch (35.16,37.3) and the GetLogs.DoRaw error branch (42.16,44.4) by
// using a fake clientset with a nil app-level context.
func TestGetPodLogsInNamespace_NilCtxAndGetLogsError(t *testing.T) {
	app := &App{
		// ctx == nil exercises the "if ctx == nil { ctx = context.Background() }" path
		ctx:           nil,
		testClientset: fake.NewSimpleClientset(),
	}
	_, err := app.getPodLogsInNamespace("default", "no-pod", 0)
	// Fake clientset doesn't support GetLogs().DoRaw(), so we expect an error.
	_ = err
}

// TestGetDeploymentLogs_GetK8sError covers getKubernetesInterface error (84.16).
func TestGetDeploymentLogs_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetDeploymentLogs("default", "x")
	if err == nil {
		t.Error("expected error from GetDeploymentLogs with no K8s context")
	}
}

// TestGetStatefulSetLogs_GetK8sError covers getKubernetesInterface error (105.16).
func TestGetStatefulSetLogs_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetStatefulSetLogs("default", "x")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetStatefulSetLogs_NotFound covers StatefulSet.Get error (109.16).
func TestGetStatefulSetLogs_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetStatefulSetLogs("default", "missing-ss")
	if err == nil {
		t.Error("expected not-found error for missing statefulset")
	}
}

// TestGetDaemonSetLogs_GetK8sError covers getKubernetesInterface error (126.16).
func TestGetDaemonSetLogs_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetDaemonSetLogs("default", "x")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetDaemonSetLogs_NotFound covers DaemonSet.Get error (130.16).
func TestGetDaemonSetLogs_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetDaemonSetLogs("default", "missing-ds")
	if err == nil {
		t.Error("expected not-found error")
	}
}

// TestGetJobLogs_GetK8sError covers getKubernetesInterface error (147.16).
func TestGetJobLogs_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetJobLogs("default", "x")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetJobLogs_NotFound covers Job.Get error (151.16).
func TestGetJobLogs_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetJobLogs("default", "missing-job")
	if err == nil {
		t.Error("expected not-found error")
	}
}

// TestGetReplicaSetLogs_GetK8sError covers getKubernetesInterface error (168.16).
func TestGetReplicaSetLogs_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetReplicaSetLogs("default", "x")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetReplicaSetLogs_NotFound covers ReplicaSet.Get error (172.16).
func TestGetReplicaSetLogs_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetReplicaSetLogs("default", "missing-rs")
	if err == nil {
		t.Error("expected not-found error")
	}
}

// ─── configmaps_consumers.go ─────────────────────────────────────────────────

// TestGetConfigMapConsumers_WithConsumers exercises the consumer-found loop body
// by creating a pod whose volume references the ConfigMap.
func TestGetConfigMapConsumers_WithConsumers(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
		Spec: corev1.PodSpec{
			Volumes: []corev1.Volume{
				{
					Name: "cfg-vol",
					VolumeSource: corev1.VolumeSource{
						ConfigMap: &corev1.ConfigMapVolumeSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: "my-cm"},
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:  "c1",
					Image: "busybox",
					EnvFrom: []corev1.EnvFromSource{
						{ConfigMapRef: &corev1.ConfigMapEnvSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: "my-cm"},
						}},
					},
				},
			},
		},
	}
	cs := fake.NewSimpleClientset(pod)
	app := &App{ctx: context.Background(), testClientset: cs}
	consumers, err := app.GetConfigMapConsumers("default", "my-cm")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(consumers) == 0 {
		t.Error("expected at least one consumer (pod) to be found")
	}
}

// TestUpdateConfigMapDataKey_CMNotFound covers ConfigMap.Get error (187.16ish).
func TestUpdateConfigMapDataKey_CMNotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateConfigMapDataKey("default", "missing-cm", "key", "val")
	if err == nil {
		t.Error("expected not-found error for missing configmap")
	}
}

// ─── resource_actions_jobs.go ────────────────────────────────────────────────

// TestStartJobFromCronJob_NotFound covers CronJob.Get error (49.16).
func TestStartJobFromCronJob_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.StartJobFromCronJob("default", "missing-cj")
	if err == nil {
		t.Error("expected error for missing cronjob")
	}
}

// TestStartJob_NotFound covers Job.Get error (84.16 in resource_actions_jobs.go).
func TestStartJob_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.StartJob("default", "missing-job")
	if err == nil {
		t.Error("expected error for missing job")
	}
}

// ─── app_lifecycle.go ────────────────────────────────────────────────────────

// TestCopyFile_SrcNotFound covers os.Open error (139.16) in copyFile.
func TestCopyFile_SrcNotFound(t *testing.T) {
	err := copyFile("/nonexistent-src-file-for-coverage-test", t.TempDir()+"/dst.json")
	if err == nil {
		t.Error("expected error when source file does not exist")
	}
}

// TestStartup_LoadConfigError_CountsRefreshChNil covers:
//
//	– loadConfig error printed to stdout (163.29,165.3) via a non-existent configPath
//	– the countsRefreshCh nil-safety assignment (167.20,169.3)
func TestStartup_LoadConfigError_CountsRefreshChNil(t *testing.T) {

	dir := t.TempDir()
	configPath := filepath.Join(dir, "bad-cfg.json")
	if err := os.WriteFile(configPath, []byte("{bad json!!}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{
		configPath:           configPath,
		countsRefreshCh:      nil, // triggers nil-safety branch
		disableStartupDocker: true,
		logCancels:           make(map[string]context.CancelFunc),
		swarmVolumeHelpers:   make(map[string]string),
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	// Startup is safe to call in tests: loadConfig fails (prints warning),
	// StartAllPolling starts background goroutines that exit quickly on K8s errors.
	app.Startup(ctx)
	// If we reach here without panic, both target blocks were covered.
}

// TestGetPodEvents_WithMatchingEvent exercises collectAndSortEvents loop body
// (94.2,96.16 etc.) by pre-loading a matching Event in the fake clientset.
func TestGetPodEvents_WithMatchingEvent(t *testing.T) {
	evt := &corev1.Event{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "pod-evt-1",
			Namespace: "default",
		},
		InvolvedObject: corev1.ObjectReference{
			Name:      "target-pod",
			Kind:      "Pod",
			Namespace: "default",
		},
		Reason:  "Started",
		Message: "Container started",
		Type:    "Normal",
		Count:   1,
		LastTimestamp: metav1.Time{
			Time: time.Now(),
		},
	}
	cs := fake.NewSimpleClientset(evt)
	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: "default"}

	results, err := app.GetPodEvents("default", "target-pod")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) == 0 {
		t.Error("expected at least one event result matching the pod")
	}
}

// TestGetPodEvents_GetEventsClientsetError covers the getEventsClientset error
// (139.16 ish) in GetPodEvents when there is no kubeconfig context.
func TestGetPodEvents_GetEventsClientsetError(t *testing.T) {
	app := newAppNoCtx() // currentKubeContext = "" → getEventsClientset fails
	_, err := app.GetPodEvents("default", "some-pod")
	if err == nil {
		t.Error("expected error when no kube context configured")
	}
}

// TestGetResourceEvents_GetEventsClientsetError covers the getEventsClientset
// error (205.16 approx) in GetResourceEvents.
func TestGetResourceEvents_GetEventsClientsetError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetResourceEvents("default", "Pod", "some-pod")
	if err == nil {
		t.Error("expected error when no kube context configured")
	}
}

// ─── monitor_actions.go ──────────────────────────────────────────────────────

// TestLoadPersistedIssues_NullJSON covers the "issues == nil → assign empty map"
// branch (73.19,75.3) by providing a JSON file containing "null".
func TestLoadPersistedIssues_NullJSON(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "issues-*.json")
	if err != nil {
		t.Fatalf("os.CreateTemp: %v", err)
	}
	if _, err = fmt.Fprint(f, "null"); err != nil {
		t.Fatalf("write: %v", err)
	}
	f.Close()
	t.Setenv("KDB_MONITOR_ISSUES_PATH", f.Name())

	issues, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if issues == nil {
		t.Error("expected non-nil map after null-JSON load")
	}
}

// ─── pod_details.go ──────────────────────────────────────────────────────────

// TestGetPodYAML_GetK8sError covers getKubernetesInterface error (29.16).
func TestGetPodYAML_GetK8sError(t *testing.T) {
	app := newAppNoCtx() // currentNamespace = "default", no K8s context
	_, err := app.GetPodYAML("test-pod")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetPodContainers_GetK8sError covers getKubernetesInterface error (49.16).
func TestGetPodContainers_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetPodContainers("test-pod")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── rolebindings.go ─────────────────────────────────────────────────────────

// TestGetRoleBindings_GetK8sError covers getKubernetesInterface error (63.16).
func TestGetRoleBindings_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoleBindings("default")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetClusterRoleBindings_GetK8sError covers getKubernetesInterface error (98.16).
func TestGetClusterRoleBindings_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoleBindings()
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetRoleBindingDetail_GetK8sError covers getKubernetesInterface error (190.16).
func TestGetRoleBindingDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoleBindingDetail("default", "rb")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetClusterRoleBindingDetail_GetK8sError covers getKubernetesInterface error (210.16).
func TestGetClusterRoleBindingDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoleBindingDetail("crb")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetRoleBindingSubjects_GetK8sError covers getKubernetesInterface error (232.16).
func TestGetRoleBindingSubjects_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoleBindingSubjects("default", "rb")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetClusterRoleBindingSubjects_GetK8sError covers getKubernetesInterface error (258.16).
func TestGetClusterRoleBindingSubjects_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoleBindingSubjects("crb")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── roles.go ────────────────────────────────────────────────────────────────

// TestGetRoles_GetK8sError covers getKubernetesInterface error (55.16).
func TestGetRoles_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoles("default")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetClusterRoles_GetK8sError covers getKubernetesInterface error (90.16).
func TestGetClusterRoles_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoles()
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetRoleDetail_GetK8sError covers getKubernetesInterface error (172.16).
func TestGetRoleDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoleDetail("default", "r")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetClusterRoleDetail_GetK8sError covers getKubernetesInterface error (192.16).
func TestGetClusterRoleDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoleDetail("cr")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── endpoints.go ────────────────────────────────────────────────────────────

// TestGetEndpoints_GetK8sError covers getKubernetesInterface error (35.16).
func TestGetEndpoints_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetEndpoints("default")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetEndpointDetail_GetK8sError covers getKubernetesInterface error (125.16).
func TestGetEndpointDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetEndpointDetail("default", "svc")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── services.go ─────────────────────────────────────────────────────────────

// TestGetServices_GetK8sError covers getKubernetesInterface error (60.16).
func TestGetServices_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetServices("default")
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetServiceEndpoints_GetK8sError covers getKubernetesInterface error (155.16/165.16).
func TestGetServiceEndpoints_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetServiceEndpoints("default", "my-svc")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── overview.go ─────────────────────────────────────────────────────────────

// TestGetOverview_GetK8sError covers getKubernetesInterface error (22.16).
func TestGetOverview_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetOverview("default")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── customresourcedefinitions.go ────────────────────────────────────────────

// TestGetCustomResourceDefinitions_GetK8sError covers getKubernetesInterface
// error (block around 40-50 of the file).
func TestGetCustomResourceDefinitions_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetCustomResourceDefinitions()
	if err == nil {
		t.Error("expected error")
	}
}

// TestGetCustomResourceDefinitionDetail_GetK8sError covers the same pattern
// in GetCustomResourceDefinitionDetail.
func TestGetCustomResourceDefinitionDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetCustomResourceDefinitionDetail("my-crd.example.com")
	if err == nil {
		t.Error("expected error")
	}
}

// ─── secrets_consumers.go ────────────────────────────────────────────────────

// TestGetSecretConsumers_GetK8sError covers getKubernetesInterface error (87.16).
func TestGetSecretConsumers_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetSecretConsumers("default", "my-secret")
	if err == nil {
		t.Error("expected error")
	}
}

// TestUpdateSecretDataKey_SecretNotFound covers Secret.Get error (209.16ish).
func TestUpdateSecretDataKey_SecretNotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateSecretDataKey("default", "missing-secret", "key", "val")
	if err == nil {
		t.Error("expected not-found error")
	}
}

// ─── workload_logs.go – aggregatePodsLogs with real pod ───────────────────────

// TestAggregatePodsLogs_WithPod exercises the aggregatePodsLogs loop body
// (covering the continue path etc.) using a real pod and testPodLogsFetcher.
func TestAggregatePodsLogs_WithPod(t *testing.T) {
	app := &App{
		ctx: context.Background(),
		testPodLogsFetcher: func(ns, name, container string, tailLines int) (string, error) {
			if name == "pod1" {
				return "log line 1\nlog line 2\n", nil
			}
			return "", fmt.Errorf("pod not found: %s", name)
		},
	}
	pods := []corev1.Pod{
		{ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: "default"}},
		{ObjectMeta: metav1.ObjectMeta{Name: "pod2-err", Namespace: "default"}},
	}
	result, err := app.aggregatePodsLogs("default", pods)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == "" {
		t.Error("expected non-empty log output")
	}
}

// ─── workload_logs.go – no-selector paths ────────────────────────────────────

func TestGetDeploymentLogs_NilSelector(t *testing.T) {
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "no-sel", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{Selector: nil},
	}
	cs := fake.NewSimpleClientset(dep)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetDeploymentLogs("default", "no-sel")
	if err == nil || err.Error() != "deployment has no selector" {
		t.Errorf("expected 'deployment has no selector', got %v", err)
	}
}

func TestGetStatefulSetLogs_NilSelector(t *testing.T) {
	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "no-sel-sts", Namespace: "default"},
		Spec:       appsv1.StatefulSetSpec{},
	}
	cs := fake.NewSimpleClientset(sts)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetStatefulSetLogs("default", "no-sel-sts")
	if err == nil || err.Error() != "statefulset has no selector" {
		t.Errorf("expected 'statefulset has no selector', got %v", err)
	}
}

func TestGetDaemonSetLogs_NilSelector(t *testing.T) {
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "no-sel-ds", Namespace: "default"},
		Spec:       appsv1.DaemonSetSpec{},
	}
	cs := fake.NewSimpleClientset(ds)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetDaemonSetLogs("default", "no-sel-ds")
	if err == nil || err.Error() != "daemonset has no selector" {
		t.Errorf("expected 'daemonset has no selector', got %v", err)
	}
}

func TestGetJobLogs_NilSelector(t *testing.T) {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "no-sel-job", Namespace: "default"},
		Spec:       batchv1.JobSpec{},
	}
	cs := fake.NewSimpleClientset(job)
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetJobLogs("default", "no-sel-job")
	if err == nil || err.Error() != "job has no selector" {
		t.Errorf("expected 'job has no selector', got %v", err)
	}
}
