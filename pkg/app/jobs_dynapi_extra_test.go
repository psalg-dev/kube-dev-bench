package app

import (
	"context"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── mockRESTScope for getResourceInterface tests ─────────────────────────────

type mockRESTScope struct{ name meta.RESTScopeName }

func (m mockRESTScope) Name() meta.RESTScopeName { return m.name }

// ─── getResourceInterface tests ───────────────────────────────────────────────

func TestGetResourceInterface_NamespacedEmptyNS(t *testing.T) {
	mapping := &meta.RESTMapping{
		Resource: schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"},
		Scope:    mockRESTScope{name: meta.RESTScopeNameNamespace},
	}
	// dynClient can be nil because we hit the error return before calling it.
	_, err := getResourceInterface(nil, mapping, "")
	if err == nil {
		t.Error("expected error for empty namespace on namespaced resource")
	}
}

func TestGetResourceInterface_NamespacedWithNS(t *testing.T) {
	s := runtime.NewScheme()
	dynClient := dynfake.NewSimpleDynamicClient(s)
	mapping := &meta.RESTMapping{
		Resource: schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"},
		Scope:    mockRESTScope{name: meta.RESTScopeNameNamespace},
	}
	ri, err := getResourceInterface(dynClient, mapping, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ri == nil {
		t.Error("expected non-nil ResourceInterface")
	}
}

func TestGetResourceInterface_ClusterScoped(t *testing.T) {
	s := runtime.NewScheme()
	dynClient := dynfake.NewSimpleDynamicClient(s)
	mapping := &meta.RESTMapping{
		Resource: schema.GroupVersionResource{Group: "", Version: "v1", Resource: "nodes"},
		Scope:    mockRESTScope{name: meta.RESTScopeNameRoot},
	}
	ri, err := getResourceInterface(dynClient, mapping, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ri == nil {
		t.Error("expected non-nil ResourceInterface")
	}
}

// ─── formatKindBytes: missing MB / GB / TB cases ─────────────────────────────

func TestFormatKindBytes_MB(t *testing.T) {
	const mb = int64(1024 * 1024)
	got := formatKindBytes(mb * 5)
	if got != "5.0MB" {
		t.Errorf("expected 5.0MB, got %q", got)
	}
}

func TestFormatKindBytes_GB(t *testing.T) {
	const gb = int64(1024 * 1024 * 1024)
	got := formatKindBytes(gb * 2)
	if got != "2.0GB" {
		t.Errorf("expected 2.0GB, got %q", got)
	}
}

func TestFormatKindBytes_TB(t *testing.T) {
	const tb = int64(1024) * int64(1024) * int64(1024) * int64(1024)
	got := formatKindBytes(tb * 3)
	if got != "3.0TB" {
		t.Errorf("expected 3.0TB, got %q", got)
	}
}

// ─── StartJobFromCronJob goroutine body coverage ──────────────────────────────

// TestStartJobFromCronJob_GoroutineBody waits long enough for the background
// goroutine to fire, which covers the goroutine closure blocks.
func TestStartJobFromCronJob_GoroutineBody(t *testing.T) {
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj-goroutine", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule: "*/5 * * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers:    []corev1.Container{{Name: "c", Image: "busybox"}},
							RestartPolicy: corev1.RestartPolicyNever,
						},
					},
				},
			},
		},
	}
	clientset := fake.NewSimpleClientset(cj)
	app := &App{ctx: context.Background(), testClientset: clientset}

	err := app.StartJobFromCronJob("default", "cj-goroutine")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Wait for the goroutine's 500ms sleep + some margin.
	time.Sleep(600 * time.Millisecond)
}

// ─── StartJob with template labels (covers deletion loop) ────────────────────

// TestStartJob_WithControllerLabels creates a job whose template has the batch
// controller labels so the label-deletion loop is exercised.
func TestStartJob_WithControllerLabels(t *testing.T) {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "labeled-job", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"controller-uid":                     "abc-123",
						"batch.kubernetes.io/controller-uid": "abc-123",
						"job-name":                           "labeled-job",
						"batch.kubernetes.io/job-name":       "labeled-job",
						"app":                                "myapp",
					},
				},
				Spec: corev1.PodSpec{
					Containers:    []corev1.Container{{Name: "c", Image: "busybox"}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	}
	clientset := fake.NewSimpleClientset(job)
	app := &App{ctx: context.Background(), testClientset: clientset}

	err := app.StartJob("default", "labeled-job")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Wait for the goroutine.
	time.Sleep(600 * time.Millisecond)
}

// TestStartJob_GoroutineBody exercises the goroutine closure in StartJob using
// a job that has no template labels (the simpler / faster code path).
func TestStartJob_GoroutineBody(t *testing.T) {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "goroutine-job", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers:    []corev1.Container{{Name: "c", Image: "busybox"}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	}
	clientset := fake.NewSimpleClientset(job)
	app := &App{ctx: context.Background(), testClientset: clientset}

	err := app.StartJob("default", "goroutine-job")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	time.Sleep(600 * time.Millisecond)
}

// ─── SuspendCronJob / ResumeCronJob happy paths ───────────────────────────────

func TestSuspendCronJob_HappyPath(t *testing.T) {
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj-suspend", Namespace: "default"},
	}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(cj)}
	if err := app.SuspendCronJob("default", "cj-suspend"); err != nil {
		t.Fatalf("SuspendCronJob error: %v", err)
	}
}

func TestResumeCronJob_HappyPath(t *testing.T) {
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj-resume", Namespace: "default"},
	}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(cj)}
	if err := app.ResumeCronJob("default", "cj-resume"); err != nil {
		t.Fatalf("ResumeCronJob error: %v", err)
	}
}

// ─── GetOverview with populated data ─────────────────────────────────────────

func TestGetOverview_WithData(t *testing.T) {
	pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"}}
	deploy := &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: "j1", Namespace: "default"}}
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset(pod, deploy)}
	info, err := app.GetOverview("default")
	if err != nil {
		t.Fatalf("GetOverview error: %v", err)
	}
	if info.Pods != 1 {
		t.Errorf("expected 1 pod, got %d", info.Pods)
	}
	if info.Jobs != 1 {
		t.Errorf("expected 1 job, got %d", info.Jobs)
	}
}
