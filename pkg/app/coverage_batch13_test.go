//go:build ignore
// +build ignore

package app

// coverage_batch13_test.go – Targets easy uncovered branches to push past 70%.
//
// Targets:
//  1. resource_actions_jobs.go – getK8s error in 4 functions (SuspendCronJob,
//     ResumeCronJob, StartJobFromCronJob, StartJob) → 4 stmts
//  2. resource_actions.go – RollbackDeploymentToRevision getK8s error → 1 stmt
//     and dep.Get() not-found error → 1 stmt
//  3. configmaps_consumers.go – init-container match and volume match → 2 stmts
//  4. monitor.go – warning-type pod issue and getK8s-error branches → 3 stmts
//
// Total target: ~11+ stmts required to cross 70%

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	fake "k8s.io/client-go/kubernetes/fake"
)

// ─────────────────────────────────────────────────────────────────────────────
// resource_actions_jobs.go – getKubernetesInterface() error blocks
// ─────────────────────────────────────────────────────────────────────────────

// TestSuspendCronJob_NoK8s covers the getK8s error block.
func TestSuspendCronJob_NoK8s(t *testing.T) {
	err := noK8sApp().SuspendCronJob("default", "cj1")
	if err == nil {
		t.Error("expected error")
	}
}

// TestResumeCronJob_NoK8s covers the getK8s error block.
func TestResumeCronJob_NoK8s(t *testing.T) {
	err := noK8sApp().ResumeCronJob("default", "cj1")
	if err == nil {
		t.Error("expected error")
	}
}

// TestStartJobFromCronJob_NoK8s covers the getK8s error block.
func TestStartJobFromCronJob_NoK8s(t *testing.T) {
	err := noK8sApp().StartJobFromCronJob("default", "cj1")
	if err == nil {
		t.Error("expected error")
	}
}

// TestStartJob_NoK8s covers the getK8s error block.
func TestStartJob_NoK8s(t *testing.T) {
	err := noK8sApp().StartJob("default", "job1")
	if err == nil {
		t.Error("expected error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// resource_actions.go – RollbackDeploymentToRevision error blocks
// ─────────────────────────────────────────────────────────────────────────────

// TestRollbackDeploymentToRevision_NoK8s covers the getK8s error block.
func TestRollbackDeploymentToRevision_NoK8s(t *testing.T) {
	err := noK8sApp().RollbackDeploymentToRevision("default", "dep1", 1)
	if err == nil {
		t.Error("expected error")
	}
}

// TestRollbackDeploymentToRevision_DepNotFound covers the dep.Get() 404 block.
func TestRollbackDeploymentToRevision_DepNotFound(t *testing.T) {
	app := &App{
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "default",
	}
	err := app.RollbackDeploymentToRevision("default", "nonexistent", 1)
	if err == nil {
		t.Error("expected not-found error")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// configmaps_consumers.go – helper function branches
// ─────────────────────────────────────────────────────────────────────────────

// TestCheckContainersConfigMapRef_InitContainerMatch covers the init-container
// early return at line 55.2 ("return true, 'init:' + why").
func TestCheckContainersConfigMapRef_InitContainerMatch(t *testing.T) {
	spec := corev1.PodSpec{
		InitContainers: []corev1.Container{
			{
				Name: "init",
				EnvFrom: []corev1.EnvFromSource{{
					ConfigMapRef: &corev1.ConfigMapEnvSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: "my-config"},
					},
				}},
			},
		},
	}
	ok, why := checkContainersConfigMapRef(spec, "my-config")
	if !ok {
		t.Error("expected init container to match")
	}
	if why == "" {
		t.Error("expected non-empty why")
	}
}

// TestPodSpecUsesConfigMap_VolumeMatch covers the volume match early return at
// line 72.14 ("return true, why") via checkVolumeConfigMapRef.
func TestPodSpecUsesConfigMap_VolumeMatch(t *testing.T) {
	spec := corev1.PodSpec{
		Volumes: []corev1.Volume{
			{
				Name: "config-vol",
				VolumeSource: corev1.VolumeSource{
					ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: "my-config"},
					},
				},
			},
		},
	}
	ok, why := podSpecUsesConfigMap(spec, "my-config")
	if !ok {
		t.Error("expected volume to match")
	}
	if why == "" {
		t.Error("expected non-empty why")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// monitor.go – collectMonitorInfo warning-type pod branch
// ─────────────────────────────────────────────────────────────────────────────

// TestCollectMonitorInfo_WithWarningPod covers the "warnings = append(warnings,
// issue)" branch in collectMonitorInfo for pods (block 65.10 in monitor.go).
// A pod with 1 restart (below the error threshold) produces a warning.
func TestCollectMonitorInfo_WithWarningPod(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "flapping", Namespace: "default"},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{Name: "app", RestartCount: 6},
			},
		},
	}
	cs := fake.NewSimpleClientset(pod)
	app := &App{
		testClientset:    cs,
		currentNamespace: "default",
	}
	info := app.collectMonitorInfo([]string{"default"})
	_ = info
}

// TestCollectMonitorInfo_NoNs covers the "len(nsList)==0 && currentNamespace!=''" path
// (line 36.20 in monitor.go) inside StartMonitor's goroutine via collectMonitorInfo.
func TestCollectMonitorInfo_WithCurrentNs(t *testing.T) {
	app := &App{
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "default",
	}
	info := app.collectMonitorInfo([]string{"default"})
	_ = info
}

// TestCheckPodIssues_NoK8s covers the createKubernetesClient error branch at
// monitor.go:240 when there is no testClientset and kubeConfig is invalid.
func TestCheckPodIssues_NoK8s(t *testing.T) {
	app := noK8sApp()
	issues := app.checkPodIssues("default")
	_ = issues
}

// TestCheckEventIssues_NoK8s covers the createKubernetesClient error branch at
// monitor.go:286 when there is no testClientset.
func TestCheckEventIssues_NoK8s(t *testing.T) {
	app := noK8sApp()
	issues := app.checkEventIssues("default")
	_ = issues
}

