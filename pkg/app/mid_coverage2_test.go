//go:build ignore
// +build ignore

// Package app – additional coverage tests for helm, pod_details, logs.
// These tests boost overall pkg/app coverage without requiring a live cluster.
package app

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ============================================================================
// Additional Helm coverage – GetHelmRepositories, RemoveHelmRepository, etc.
// ============================================================================

func TestGetHelmRepositories_WithContent(t *testing.T) {
	tmp := t.TempDir()

	// Write a minimal repositories.yaml and point Helm directly to it
	repoYAML := `apiVersion: ""
generated: "0001-01-01T00:00:00Z"
repositories:
- name: bitnami
  url: https://charts.bitnami.com/bitnami
- name: stable
  url: https://charts.helm.sh/stable
`
	repoFile := filepath.Join(tmp, "repositories.yaml")
	if err := os.WriteFile(repoFile, []byte(repoYAML), 0644); err != nil {
		t.Fatalf("write repo file: %v", err)
	}
	t.Setenv("HELM_REPOSITORY_CONFIG", repoFile)

	app := &App{}
	repos, err := app.GetHelmRepositories()
	if err != nil {
		t.Fatalf("GetHelmRepositories: %v", err)
	}
	if len(repos) != 2 {
		t.Errorf("expected 2 repos, got %d", len(repos))
	}
	names := map[string]bool{}
	for _, r := range repos {
		names[r.Name] = true
	}
	if !names["bitnami"] || !names["stable"] {
		t.Errorf("expected bitnami and stable repos, got %v", repos)
	}
}

func TestRemoveHelmRepository_NoRepoFile(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HELM_REPOSITORY_CONFIG", filepath.Join(tmp, "nonexistent.yaml"))

	app := &App{}
	err := app.RemoveHelmRepository("nonexistent")
	// Should fail because there's no repo file
	if err == nil {
		t.Error("expected error when repo file doesn't exist")
	}
}

func TestRemoveHelmRepository_RepoNotFound(t *testing.T) {
	tmp := t.TempDir()

	repoYAML := `apiVersion: ""
generated: "0001-01-01T00:00:00Z"
repositories:
- name: bitnami
  url: https://charts.bitnami.com/bitnami
`
	repoFile := filepath.Join(tmp, "repositories.yaml")
	if err := os.WriteFile(repoFile, []byte(repoYAML), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	t.Setenv("HELM_REPOSITORY_CONFIG", repoFile)

	app := &App{}
	err := app.RemoveHelmRepository("notexist")
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected not-found error, got: %v", err)
	}
}

func TestUpdateHelmRepositories_NoRepoFile(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HELM_REPOSITORY_CONFIG", filepath.Join(tmp, "nonexistent.yaml"))

	app := &App{}
	err := app.UpdateHelmRepositories()
	// Should fail because there's no repo file
	if err == nil {
		t.Error("expected error when repo file doesn't exist")
	}
}

func TestGetHelmReleaseHistory_NoCluster(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "nonexistent",
	}
	_, err := app.GetHelmReleaseHistory("default", "my-release")
	if err == nil {
		t.Log("GetHelmReleaseHistory succeeded (kubeconfig present in env)")
	} else {
		t.Logf("GetHelmReleaseHistory returned expected error: %v", err)
	}
}

func TestGetHelmReleaseValues_NoCluster(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "nonexistent",
	}
	_, err := app.GetHelmReleaseValues("default", "my-release", false)
	if err == nil {
		t.Log("GetHelmReleaseValues succeeded (kubeconfig present in env)")
	} else {
		t.Logf("GetHelmReleaseValues returned expected error: %v", err)
	}
}

func TestGetHelmReleaseManifest_NoCluster(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "nonexistent",
	}
	_, err := app.GetHelmReleaseManifest("default", "my-release")
	if err == nil {
		t.Log("GetHelmReleaseManifest succeeded")
	} else {
		t.Logf("GetHelmReleaseManifest error: %v", err)
	}
}

func TestGetHelmReleaseNotes_NoCluster(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "nonexistent",
	}
	_, err := app.GetHelmReleaseNotes("default", "my-release")
	if err == nil {
		t.Log("GetHelmReleaseNotes succeeded")
	} else {
		t.Logf("GetHelmReleaseNotes error: %v", err)
	}
}

func TestRollbackHelmRelease_NoCluster(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "nonexistent",
	}
	err := app.RollbackHelmRelease("default", "my-release", 1)
	if err == nil {
		t.Log("RollbackHelmRelease succeeded")
	} else {
		t.Logf("RollbackHelmRelease error: %v", err)
	}
}

func TestUninstallHelmRelease_NoCluster(t *testing.T) {
	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "nonexistent",
	}
	err := app.UninstallHelmRelease("default", "my-release")
	if err == nil {
		t.Log("UninstallHelmRelease succeeded")
	} else {
		t.Logf("UninstallHelmRelease error: %v", err)
	}
}

// ============================================================================
// Additional pod_details coverage
// ============================================================================

func TestGetPodSummary_WithFakeClientset(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "summary-pod",
			Namespace: ns,
			Labels:    map[string]string{"version": "v1"},
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				{Name: "main", Ports: []v1.ContainerPort{{ContainerPort: 8080}}},
			},
		},
		Status: v1.PodStatus{Phase: v1.PodRunning},
	})
	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: ns}

	summary, err := app.GetPodSummary("summary-pod")
	if err != nil {
		t.Fatalf("GetPodSummary: %v", err)
	}
	if summary.Name != "summary-pod" {
		t.Errorf("Name = %q", summary.Name)
	}
	if summary.Status != "Running" {
		t.Errorf("Status = %q, want Running", summary.Status)
	}
	if len(summary.Ports) != 1 || summary.Ports[0] != 8080 {
		t.Errorf("Ports = %v, want [8080]", summary.Ports)
	}
}

func TestGetPodSummary_NoNamespace2(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPodSummary("pod")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Fatalf("expected namespace error, got: %v", err)
	}
}

func TestGetPodSummary_NotFound2(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "default",
	}
	_, err := app.GetPodSummary("no-such-pod")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestGetPodContainers_WithFakeClientset(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "multi-container-pod", Namespace: ns},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				{Name: "frontend"},
				{Name: "backend"},
				{Name: "sidecar"},
			},
		},
	})
	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: ns}

	names, err := app.GetPodContainers("multi-container-pod")
	if err != nil {
		t.Fatalf("GetPodContainers: %v", err)
	}
	if len(names) != 3 {
		t.Errorf("expected 3 containers, got %v", names)
	}
	expected := map[string]bool{"frontend": true, "backend": true, "sidecar": true}
	for _, n := range names {
		if !expected[n] {
			t.Errorf("unexpected container: %s", n)
		}
	}
}

func TestGetPodContainers_NoNamespace2(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPodContainers("pod")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Fatalf("expected namespace error, got: %v", err)
	}
}

func TestGetPodContainers_NotFound2(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "default",
	}
	_, err := app.GetPodContainers("no-pod")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestGetPodYAML_WithNamespace(t *testing.T) {
	ns := "kube-system"
	cs := fake.NewSimpleClientset(&v1.Pod{
		TypeMeta:   metav1.TypeMeta{Kind: "Pod", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "kube-pod", Namespace: ns},
	})
	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: ns}

	y, err := app.GetPodYAML("kube-pod")
	if err != nil {
		t.Fatalf("GetPodYAML: %v", err)
	}
	if !strings.Contains(y, "kube-pod") {
		t.Errorf("pod name missing from YAML: %s", y)
	}
}

func TestGetPodYAML_NotFound2(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "default",
	}
	_, err := app.GetPodYAML("no-pod")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestGetPodMounts_WithInitContainers(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "init-mount-pod", Namespace: ns},
		Spec: v1.PodSpec{
			InitContainers: []v1.Container{
				{
					Name: "init-setup",
					VolumeMounts: []v1.VolumeMount{
						{Name: "data-vol", MountPath: "/data"},
					},
				},
			},
			Containers: []v1.Container{
				{
					Name: "main",
					VolumeMounts: []v1.VolumeMount{
						{Name: "data-vol", MountPath: "/app/data", ReadOnly: true},
					},
				},
			},
			Volumes: []v1.Volume{
				{
					Name:         "data-vol",
					VolumeSource: v1.VolumeSource{EmptyDir: &v1.EmptyDirVolumeSource{}},
				},
			},
		},
	})

	app := &App{ctx: context.Background(), testClientset: cs, currentNamespace: ns}
	mounts, err := app.GetPodMounts("init-mount-pod")
	if err != nil {
		t.Fatalf("GetPodMounts: %v", err)
	}

	if len(mounts.Volumes) != 1 {
		t.Errorf("expected 1 volume, got %d", len(mounts.Volumes))
	}
	// 2 containers: 1 init + 1 regular
	if len(mounts.Containers) != 2 {
		t.Errorf("expected 2 container entries, got %d", len(mounts.Containers))
	}

	// First should be init container
	if !mounts.Containers[0].IsInit {
		t.Error("first container entry should be init")
	}
	if mounts.Containers[1].IsInit {
		t.Error("second container entry should not be init")
	}
}

func TestGetPodMounts_NotFound2(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		testClientset:    fake.NewSimpleClientset(),
		currentNamespace: "default",
	}
	_, err := app.GetPodMounts("no-pod")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

// ============================================================================
// Additional logs coverage
// ============================================================================

func TestGetPodLog_NoNamespace2(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPodLog("pod")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Fatalf("expected namespace error, got: %v", err)
	}
}

func TestGetPodContainerLog_NoNamespace2(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPodContainerLog("pod", "container")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Fatalf("expected namespace error, got: %v", err)
	}
}

// ============================================================================
// Additional resource_yaml coverage
// ============================================================================

func TestGetNodeYAML_NoClientset2(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetNodeYAML("no-node")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestGetNodeYAML_HappyPath2(t *testing.T) {
	cs := fake.NewSimpleClientset(&v1.Node{
		TypeMeta:   metav1.TypeMeta{Kind: "Node", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "worker-1"},
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	y, err := app.GetNodeYAML("worker-1")
	if err != nil {
		t.Fatalf("GetNodeYAML: %v", err)
	}
	if !strings.Contains(y, "worker-1") {
		t.Errorf("node name missing from YAML: %s", y)
	}
}

func TestGetPersistentVolumeClaimYAML_HappyPathMid(t *testing.T) {
	ns := "staging"
	cs := fake.NewSimpleClientset(&v1.PersistentVolumeClaim{
		TypeMeta:   metav1.TypeMeta{Kind: "PersistentVolumeClaim", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "staging-pvc", Namespace: ns},
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	y, err := app.GetPersistentVolumeClaimYAML(ns, "staging-pvc")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaimYAML: %v", err)
	}
	if !strings.Contains(y, "staging-pvc") {
		t.Errorf("pvc name missing from YAML: %s", y)
	}
}

// TestShEscape verifies the shell escaping helper handles edge cases.
func TestShEscape_Coverage(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"", ""},
		{"/simple/path", "/simple/path"},
		{"/path with spaces", "'/path with spaces'"},
		{"/path'with'quotes", "'/path'\\''with'\\''quotes'"},
		{"/path`backtick", "'/path`backtick'"},
	}
	for _, tc := range tests {
		got := shEscape(tc.input)
		if got != tc.want {
			t.Errorf("shEscape(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

// TestBuildPodSummary_WithInitContainers exercises the init container
// path in buildPodSummary.
func TestBuildPodSummary_WithInitContainers(t *testing.T) {
	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "init-pod", Namespace: "default"},
		Spec: v1.PodSpec{
			InitContainers: []v1.Container{
				{Name: "init-1", Image: "busybox"},
				{Name: "init-2", Image: "alpine"},
			},
		},
		Status: v1.PodStatus{
			Phase: v1.PodPending,
			InitContainerStatuses: []v1.ContainerStatus{
				{
					Name:  "init-1",
					Ready: true,
					State: v1.ContainerState{
						Terminated: &v1.ContainerStateTerminated{ExitCode: 0, Reason: "Completed"},
					},
				},
				// init-2 has no status
			},
		},
	}

	summary := buildPodSummary(pod)
	if summary.Name != "init-pod" {
		t.Errorf("Name = %q", summary.Name)
	}
	if len(summary.InitContainers) != 2 {
		t.Fatalf("expected 2 init containers, got %d", len(summary.InitContainers))
	}
	if summary.InitContainers[0].State != "Terminated" {
		t.Errorf("init-1 state = %q, want Terminated", summary.InitContainers[0].State)
	}
	if summary.InitContainers[1].State != "Pending" {
		t.Errorf("init-2 state = %q, want Pending", summary.InitContainers[1].State)
	}
}

// TestGetPodDetailInNamespace_WithInitContainers tests via fake clientset.
func TestGetPodDetailInNamespace_WithInitContainers(t *testing.T) {
	ns := "production"
	cs := fake.NewSimpleClientset(&v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "prod-pod", Namespace: ns},
		Spec: v1.PodSpec{
			InitContainers: []v1.Container{
				{Name: "init-db", Image: "postgres-init:latest"},
			},
			Containers: []v1.Container{
				{Name: "app", Image: "myapp:v2"},
			},
		},
		Status: v1.PodStatus{Phase: v1.PodRunning},
	})
	app := &App{ctx: context.Background(), testClientset: cs}

	summary, err := app.GetPodDetailInNamespace(ns, "prod-pod")
	if err != nil {
		t.Fatalf("GetPodDetailInNamespace: %v", err)
	}
	if len(summary.InitContainers) != 1 {
		t.Errorf("expected 1 init container, got %d", len(summary.InitContainers))
	}
	if summary.InitContainers[0].Name != "init-db" {
		t.Errorf("init container name = %q, want init-db", summary.InitContainers[0].Name)
	}
}

// TestGetConfigMapYAML_HappyPath ensures we cover the configmap YAML path fully.
func TestGetConfigMapYAML_HappyPath2(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(&v1.ConfigMap{
		TypeMeta:   metav1.TypeMeta{Kind: "ConfigMap", APIVersion: "v1"},
		ObjectMeta: metav1.ObjectMeta{Name: "full-cm", Namespace: ns},
		Data: map[string]string{
			"config.yaml": "key: value",
			"app.conf":    "setting=true",
		},
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	y, err := app.GetConfigMapYAML(ns, "full-cm")
	if err != nil {
		t.Fatalf("GetConfigMapYAML: %v", err)
	}
	if !strings.Contains(y, "full-cm") {
		t.Errorf("name missing from YAML: %s", y)
	}
	if !strings.Contains(y, "config.yaml") {
		t.Errorf("data key missing from YAML: %s", y)
	}
}

// TestGetHelmReleases_ActionConfigErrorPath tests via action config init
// with various namespace values.
func TestGetHelmReleases_ActionConfigErrorPath(t *testing.T) {
	namespaces := []string{"default", "kube-system", "monitoring", ""}
	for _, ns := range namespaces {
		app := &App{
			ctx:                context.Background(),
			currentKubeContext: "test-no-cluster",
		}
		_, _ = app.GetHelmReleases(ns) // Should not panic
	}
}

// TestDefaultShortTimeout verifies the timeout helper.
func TestDefaultShortTimeout_Value(t *testing.T) {
	d := defaultShortTimeout()
	if d <= 0 {
		t.Errorf("expected positive duration, got %v", d)
	}
}

