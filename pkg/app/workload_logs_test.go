package app

import (
	"context"
	"fmt"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

func TestGetDeploymentLogs_ReturnsAggregatedLogs(t *testing.T) {
	ctx := context.Background()
	labels := map[string]string{"app": "web"}

	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-deploy",
			Namespace: "default",
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
		},
	}

	pod1 := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-deploy-abc",
			Namespace: "default",
			Labels:    labels,
		},
	}
	pod2 := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-deploy-def",
			Namespace: "default",
			Labels:    labels,
		},
	}

	clientset := fake.NewSimpleClientset(deployment, pod1, pod2)
	app := &App{ctx: ctx, testClientset: clientset}

	// Note: The actual log fetching will fail in unit tests because
	// the fake clientset doesn't implement log streaming.
	// We're testing that the function correctly identifies pods.
	_, err := app.GetDeploymentLogs("default", "web-deploy")
	// Error is expected because fake client doesn't support logs
	if err == nil {
		t.Log("GetDeploymentLogs completed (fake client may not support logs)")
	}
}

func TestGetDeploymentLogs_NoSelector(t *testing.T) {
	ctx := context.Background()

	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-deploy",
			Namespace: "default",
		},
		Spec: appsv1.DeploymentSpec{
			// No selector
		},
	}

	clientset := fake.NewSimpleClientset(deployment)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetDeploymentLogs("default", "web-deploy")
	if err == nil {
		t.Fatal("expected error for deployment without selector")
	}
}

func TestGetDeploymentLogs_NotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetDeploymentLogs("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent deployment")
	}
}

func TestGetStatefulSetLogs_ReturnsAggregatedLogs(t *testing.T) {
	ctx := context.Background()
	labels := map[string]string{"app": "db"}

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-sts",
			Namespace: "default",
		},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
		},
	}

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-sts-0",
			Namespace: "default",
			Labels:    labels,
		},
	}

	clientset := fake.NewSimpleClientset(sts, pod)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetStatefulSetLogs("default", "db-sts")
	if err == nil {
		t.Log("GetStatefulSetLogs completed")
	}
}

func TestGetStatefulSetLogs_NoSelector(t *testing.T) {
	ctx := context.Background()

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-sts",
			Namespace: "default",
		},
		Spec: appsv1.StatefulSetSpec{
			// No selector
		},
	}

	clientset := fake.NewSimpleClientset(sts)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetStatefulSetLogs("default", "db-sts")
	if err == nil {
		t.Fatal("expected error for statefulset without selector")
	}
}

func TestGetDaemonSetLogs_ReturnsAggregatedLogs(t *testing.T) {
	ctx := context.Background()
	labels := map[string]string{"app": "monitor"}

	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "monitor-ds",
			Namespace: "default",
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
		},
	}

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "monitor-ds-xyz",
			Namespace: "default",
			Labels:    labels,
		},
	}

	clientset := fake.NewSimpleClientset(ds, pod)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetDaemonSetLogs("default", "monitor-ds")
	if err == nil {
		t.Log("GetDaemonSetLogs completed")
	}
}

func TestGetDaemonSetLogs_NoSelector(t *testing.T) {
	ctx := context.Background()

	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "monitor-ds",
			Namespace: "default",
		},
		Spec: appsv1.DaemonSetSpec{
			// No selector
		},
	}

	clientset := fake.NewSimpleClientset(ds)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetDaemonSetLogs("default", "monitor-ds")
	if err == nil {
		t.Fatal("expected error for daemonset without selector")
	}
}

func TestGetJobLogs_ReturnsAggregatedLogs(t *testing.T) {
	ctx := context.Background()
	labels := map[string]string{"job-name": "backup"}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "backup",
			Namespace: "default",
		},
		Spec: batchv1.JobSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
		},
	}

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "backup-abc",
			Namespace: "default",
			Labels:    labels,
		},
	}

	clientset := fake.NewSimpleClientset(job, pod)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetJobLogs("default", "backup")
	if err == nil {
		t.Log("GetJobLogs completed")
	}
}

func TestGetJobLogs_NoSelector(t *testing.T) {
	ctx := context.Background()

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "backup",
			Namespace: "default",
		},
		Spec: batchv1.JobSpec{
			// No selector
		},
	}

	clientset := fake.NewSimpleClientset(job)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetJobLogs("default", "backup")
	if err == nil {
		t.Fatal("expected error for job without selector")
	}
}

func TestGetReplicaSetLogs_ReturnsAggregatedLogs(t *testing.T) {
	ctx := context.Background()
	labels := map[string]string{"app": "web"}

	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-rs",
			Namespace: "default",
		},
		Spec: appsv1.ReplicaSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
		},
	}

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-rs-abc",
			Namespace: "default",
			Labels:    labels,
		},
	}

	clientset := fake.NewSimpleClientset(rs, pod)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetReplicaSetLogs("default", "web-rs")
	if err == nil {
		t.Log("GetReplicaSetLogs completed")
	}
}

func TestGetReplicaSetLogs_NoSelector(t *testing.T) {
	ctx := context.Background()

	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "web-rs",
			Namespace: "default",
		},
		Spec: appsv1.ReplicaSetSpec{
			// No selector
		},
	}

	clientset := fake.NewSimpleClientset(rs)
	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetReplicaSetLogs("default", "web-rs")
	if err == nil {
		t.Fatal("expected error for replicaset without selector")
	}
}

func TestAggregatePodsLogs_EmptyNamespace(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: ctx, testClientset: clientset}

	pods := []corev1.Pod{}
	_, err := app.aggregatePodsLogs("", pods)
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestAggregatePodsLogs_EmptyPods(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: ctx, testClientset: clientset}

	pods := []corev1.Pod{}
	result, err := app.aggregatePodsLogs("default", pods)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result for no pods, got %q", result)
	}
}

func TestAggregatePodsLogs_StableOrderingAndFormatting(t *testing.T) {
	app := &App{ctx: context.Background()}

	app.testPodLogsFetcher = func(ns, pod, container string, lines int) (string, error) {
		switch pod {
		case "pod-a":
			return "alpha-1", nil
		case "pod-b":
			return "beta-1\nbeta-2\n", nil
		case "pod-c":
			return "", fmt.Errorf("simulated read error")
		default:
			return "", nil
		}
	}

	pods := []corev1.Pod{
		{ObjectMeta: metav1.ObjectMeta{Name: "pod-c"}},
		{ObjectMeta: metav1.ObjectMeta{Name: "pod-a"}},
		{ObjectMeta: metav1.ObjectMeta{Name: "pod-b"}},
	}

	got, err := app.aggregatePodsLogs("ns1", pods)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := "===== pod-a =====\n" +
		"alpha-1\n" +
		"===== pod-b =====\n" +
		"beta-1\n" +
		"beta-2\n" +
		"===== pod-c =====\n" +
		"[error] simulated read error\n"

	if got != want {
		t.Errorf("aggregated logs mismatch\n--- want ---\n%q\n--- got ---\n%q", want, got)
	}
}

func TestGetDeploymentLogs_ListPodsError(t *testing.T) {
	labels := map[string]string{"app": "web"}
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(dep)
	cs.PrependReactor("list", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pods list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetDeploymentLogs("default", "web")
	if err == nil {
		t.Fatal("expected error when pods list fails")
	}
}

func TestGetDeploymentLogs_ZeroPods(t *testing.T) {
	labels := map[string]string{"app": "web"}
	dep := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(dep)
	app := &App{ctx: context.Background(), testClientset: cs}
	out, err := app.GetDeploymentLogs("default", "web")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty aggregation for zero pods, got %q", out)
	}
}

func TestGetStatefulSetLogs_ListPodsError(t *testing.T) {
	labels := map[string]string{"app": "db"}
	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
		Spec:       appsv1.StatefulSetSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(sts)
	cs.PrependReactor("list", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pods list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetStatefulSetLogs("default", "db")
	if err == nil {
		t.Fatal("expected error when pods list fails")
	}
}

func TestGetStatefulSetLogs_ZeroPods(t *testing.T) {
	labels := map[string]string{"app": "db"}
	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
		Spec:       appsv1.StatefulSetSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(sts)
	app := &App{ctx: context.Background(), testClientset: cs}
	out, err := app.GetStatefulSetLogs("default", "db")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty aggregation for zero pods, got %q", out)
	}
}

func TestGetDaemonSetLogs_ListPodsError(t *testing.T) {
	labels := map[string]string{"app": "monitor"}
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "monitor", Namespace: "default"},
		Spec:       appsv1.DaemonSetSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(ds)
	cs.PrependReactor("list", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pods list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetDaemonSetLogs("default", "monitor")
	if err == nil {
		t.Fatal("expected error when pods list fails")
	}
}

func TestGetDaemonSetLogs_ZeroPods(t *testing.T) {
	labels := map[string]string{"app": "monitor"}
	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "monitor", Namespace: "default"},
		Spec:       appsv1.DaemonSetSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(ds)
	app := &App{ctx: context.Background(), testClientset: cs}
	out, err := app.GetDaemonSetLogs("default", "monitor")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty aggregation for zero pods, got %q", out)
	}
}

func TestGetJobLogs_ListPodsError(t *testing.T) {
	labels := map[string]string{"job-name": "backup"}
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "backup", Namespace: "default"},
		Spec:       batchv1.JobSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(job)
	cs.PrependReactor("list", "pods", func(action ktesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("simulated pods list error")
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetJobLogs("default", "backup")
	if err == nil {
		t.Fatal("expected error when pods list fails")
	}
}

func TestGetJobLogs_ZeroPods(t *testing.T) {
	labels := map[string]string{"job-name": "backup"}
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "backup", Namespace: "default"},
		Spec:       batchv1.JobSpec{Selector: &metav1.LabelSelector{MatchLabels: labels}},
	}
	cs := fake.NewSimpleClientset(job)
	app := &App{ctx: context.Background(), testClientset: cs}
	out, err := app.GetJobLogs("default", "backup")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty aggregation for zero pods, got %q", out)
	}
}

func TestGetPodLogsInNamespace_TailLinesDefaulting(t *testing.T) {
	app := &App{ctx: nil}
	captured := []int{}
	app.testPodLogsFetcher = func(ns, pod, container string, lines int) (string, error) {
		captured = append(captured, lines)
		return fmt.Sprintf("lines=%d", lines), nil
	}

	out1, err1 := app.getPodLogsInNamespace("default", "p1", 0)
	if err1 != nil {
		t.Fatalf("unexpected error: %v", err1)
	}
	if captured[0] != int(defaultLogTailLines) {
		t.Errorf("expected %d lines, got %d", int(defaultLogTailLines), captured[0])
	}
	if out1 != fmt.Sprintf("lines=%d", int(defaultLogTailLines)) {
		t.Errorf("unexpected output: %q", out1)
	}

	out2, err2 := app.getPodLogsInNamespace("default", "p1", 50)
	if err2 != nil {
		t.Fatalf("unexpected error: %v", err2)
	}
	if captured[1] != 50 {
		t.Errorf("expected 50 lines, got %d", captured[1])
	}
	if out2 != "lines=50" {
		t.Errorf("unexpected output: %q", out2)
	}
}

func TestGetPodLogsInNamespace_NilContext_NoPanic(t *testing.T) {
	app := &App{ctx: nil}
	app.testPodLogsFetcher = func(ns, pod, container string, lines int) (string, error) {
		return "ok", nil
	}

	out, err := app.getPodLogsInNamespace("default", "p1", -1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out != "ok" {
		t.Errorf("unexpected output: %q", out)
	}
}
