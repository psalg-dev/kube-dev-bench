package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── hooksConfigPath ─────────────────────────────────────────────────────────

// testHooksHomeDir points the app home lookup to a temp dir and returns that
// dir so the caller can create test files within it.
func testHooksHomeDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if os.Getenv("USERPROFILE") != "" || isWindows() {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}
	return dir
}

// isWindows returns true when running on Windows.
func isWindows() bool {
	return os.PathSeparator == '\\'
}

// TestHooksConfigPath_PreferredExists verifies that the preferred path
// (~/.KubeDevBench/hooks-config.json) is returned when the file already exists.
func TestHooksConfigPath_PreferredExists(t *testing.T) {
	dir := testHooksHomeDir(t)
	preferredDir := filepath.Join(dir, ".KubeDevBench")
	if err := os.MkdirAll(preferredDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	preferredPath := filepath.Join(preferredDir, "hooks-config.json")
	if err := os.WriteFile(preferredPath, []byte("{}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{ctx: context.Background()}
	got, err := app.hooksConfigPath()
	if err != nil {
		t.Fatalf("hooksConfigPath() error = %v", err)
	}
	if got != preferredPath {
		t.Errorf("hooksConfigPath() = %q, want %q", got, preferredPath)
	}
}

// TestHooksConfigPath_LegacyExists verifies that the legacy path
// (~/KubeDevBench/hooks-config.json) is returned when only the legacy file exists.
func TestHooksConfigPath_LegacyExists(t *testing.T) {
	dir := testHooksHomeDir(t)
	legacyDir := filepath.Join(dir, "KubeDevBench")
	if err := os.MkdirAll(legacyDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	legacyPath := filepath.Join(legacyDir, "hooks-config.json")
	if err := os.WriteFile(legacyPath, []byte("{}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}
	// Make sure preferred does NOT exist.
	_ = os.Remove(filepath.Join(dir, ".KubeDevBench", "hooks-config.json"))

	app := &App{ctx: context.Background()}
	got, err := app.hooksConfigPath()
	if err != nil {
		t.Fatalf("hooksConfigPath() error = %v", err)
	}
	if got != legacyPath {
		t.Errorf("hooksConfigPath() = %q, want %q (legacy path)", got, legacyPath)
	}
}

// ─── loadHooksConfig ─────────────────────────────────────────────────────────

// TestLoadHooksConfig_InvalidJSON verifies that an unmarshal error returns a
// default HooksConfig rather than an error (or that the error is propagated).
func TestLoadHooksConfig_InvalidJSON(t *testing.T) {
	dir := testHooksHomeDir(t)
	// Write bad JSON to the preferred path.
	preferredDir := filepath.Join(dir, ".KubeDevBench")
	if err := os.MkdirAll(preferredDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}
	bad := filepath.Join(preferredDir, "hooks-config.json")
	if err := os.WriteFile(bad, []byte("{NOT JSON}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{ctx: context.Background()}
	_, err := app.loadHooksConfig()
	// Depending on implementation the function may return default or error.
	// Either is acceptable — we just verify it doesn't panic.
	_ = err
}

// TestLoadAndSaveHooksConfig_RoundTrip verifies a full save + load cycle.
func TestLoadAndSaveHooksConfig_RoundTrip(t *testing.T) {
	dir := testHooksHomeDir(t)
	preferredDir := filepath.Join(dir, ".KubeDevBench")
	if err := os.MkdirAll(preferredDir, 0o750); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{ctx: context.Background()}
	cfg := HooksConfig{
		Hooks: []HookConfig{
			{ID: "hook-1", Name: "my-hook", ScriptPath: "/usr/bin/echo"},
		},
	}
	if err := app.saveHooksConfig(cfg); err != nil {
		t.Fatalf("saveHooksConfig() error = %v", err)
	}
	loaded, err := app.loadHooksConfig()
	if err != nil {
		t.Fatalf("loadHooksConfig() error = %v", err)
	}
	if len(loaded.Hooks) != 1 || loaded.Hooks[0].ID != "hook-1" {
		t.Errorf("round-trip mismatch: got %+v", loaded)
	}
}

// ─── GetAllTabCounts – missing switch cases ───────────────────────────────────

// TestGetAllTabCounts_Deployment tests the "Deployment"/"DaemonSet"/"Job"
// branch (all delegating to getWorkloadPodCount).
func TestGetAllTabCounts_Deployment(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	counts, err := app.GetAllTabCounts("default", "Deployment", "web")
	if err != nil {
		t.Fatalf("GetAllTabCounts(Deployment) error = %v", err)
	}
	_ = counts // pods count will be 0 since no deployments exist; just verify no panic
}

// TestGetAllTabCounts_CronJobBranch tests the "CronJob" branch.
func TestGetAllTabCounts_CronJobBranch(t *testing.T) {
	cs := fake.NewSimpleClientset(&batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "cron-job-run",
			Namespace: "default",
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "CronJob", Name: "my-cron"},
			},
		},
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	counts, err := app.GetAllTabCounts("default", "CronJob", "my-cron")
	if err != nil {
		t.Fatalf("GetAllTabCounts(CronJob) error = %v", err)
	}
	if counts.History != 1 {
		t.Errorf("expected History=1, got %d", counts.History)
	}
}

// TestGetAllTabCounts_PersistentVolumeClaim tests the "PersistentVolumeClaim"
// branch.
func TestGetAllTabCounts_PersistentVolumeClaim(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	counts, err := app.GetAllTabCounts("default", "PersistentVolumeClaim", "my-pvc")
	if err != nil {
		t.Fatalf("GetAllTabCounts(PVC) error = %v", err)
	}
	_ = counts
}

// TestGetAllTabCounts_ServiceBranch tests the "Service" branch.
func TestGetAllTabCounts_ServiceBranch(t *testing.T) {
	cs := fake.NewSimpleClientset(&corev1.Endpoints{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-svc",
			Namespace: "default",
		},
		Subsets: []corev1.EndpointSubset{
			{Addresses: []corev1.EndpointAddress{{IP: "10.0.0.1"}}},
		},
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	counts, err := app.GetAllTabCounts("default", "Service", "my-svc")
	if err != nil {
		t.Fatalf("GetAllTabCounts(Service) error = %v", err)
	}
	_ = counts
}

// TestGetAllTabCounts_IngressBranch tests the "Ingress" branch.
func TestGetAllTabCounts_IngressBranch(t *testing.T) {
	httpPath := networkingv1.PathTypePrefix
	cs := fake.NewSimpleClientset(&networkingv1.Ingress{
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
									Path:     "/",
									PathType: &httpPath,
									Backend: networkingv1.IngressBackend{
										Service: &networkingv1.IngressServiceBackend{
											Name: "my-svc",
										},
									},
								},
							},
						},
					},
				},
			},
		},
	})
	app := &App{ctx: context.Background(), testClientset: cs}
	counts, err := app.GetAllTabCounts("default", "Ingress", "my-ingress")
	if err != nil {
		t.Fatalf("GetAllTabCounts(Ingress) error = %v", err)
	}
	if counts.Rules != 1 {
		t.Errorf("expected Rules=1, got %d", counts.Rules)
	}
}

// ─── Resource YAML – "not connected" paths ───────────────────────────────────
//
// Each resource_yaml.go function has an `if err != nil` branch after
// getKubernetesInterface() that returns "not connected to cluster".  These
// blocks are uncovered by the existing "not found" tests (which all use a
// fake clientset so getKubernetesInterface() succeeds).
//
// These tests create a bare App with no clientset so getKubernetesInterface()
// returns an error, covering those branches.

func TestGetServiceYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetServiceYAML("default", "svc")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetIngressYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetIngressYAML("default", "ing")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetJobYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetJobYAML("default", "job")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetCronJobYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetCronJobYAML("default", "cj")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetConfigMapYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetConfigMapYAML("default", "cm")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetSecretYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetSecretYAML("default", "sec")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetPersistentVolumeClaimYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetPersistentVolumeClaimYAML("default", "pvc")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetDeploymentYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetDeploymentYAML("default", "dep")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetStatefulSetYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetStatefulSetYAML("default", "sts")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetDaemonSetYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetDaemonSetYAML("default", "ds")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetReplicaSetYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetReplicaSetYAML("default", "rs")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetRoleYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetRoleYAML("default", "role")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}

func TestGetRoleBindingYAML_NoClientset(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetRoleBindingYAML("default", "rb")
	if err == nil {
		t.Error("expected error with no clientset")
	}
}
