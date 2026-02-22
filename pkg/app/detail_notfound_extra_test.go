package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── Resource detail "not found" error paths ─────────────────────────────────
// These tests call GetXxxDetail with a nonexistent resource name on an empty
// fake clientset so the Kubernetes GET call returns a not-found error.

func TestGetRoleDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetRoleDetail("default", "ghost-role")
	if err == nil {
		t.Error("expected error for nonexistent role")
	}
}

func TestGetClusterRoleDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetClusterRoleDetail("ghost-clusterrole")
	if err == nil {
		t.Error("expected error for nonexistent cluster role")
	}
}

func TestGetRoleBindingDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetRoleBindingDetail("default", "ghost-rb")
	if err == nil {
		t.Error("expected error for nonexistent role binding")
	}
}

func TestGetClusterRoleBindingDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetClusterRoleBindingDetail("ghost-crb")
	if err == nil {
		t.Error("expected error for nonexistent cluster role binding")
	}
}

func TestGetServiceAccountDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetServiceAccountDetail("default", "ghost-sa")
	if err == nil {
		t.Error("expected error for nonexistent service account")
	}
}

func TestGetNetworkPolicyDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetNetworkPolicyDetail("default", "ghost-np")
	if err == nil {
		t.Error("expected error for nonexistent network policy")
	}
}

func TestGetEndpointDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetEndpointDetail("default", "ghost-ep")
	if err == nil {
		t.Error("expected error for nonexistent endpoint")
	}
}

func TestGetStorageClassDetail_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetStorageClassDetail("ghost-sc")
	if err == nil {
		t.Error("expected error for nonexistent storage class")
	}
}

// ─── UpdateConfigMapDataKey – empty configMapName validation ──────────────────

// TestUpdateConfigMapDataKey_EmptyConfigMapName covers the configMapName == ""
// validation path that is not covered by earlier tests.
func TestUpdateConfigMapDataKey_EmptyConfigMapName(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateConfigMapDataKey("default", "", "k", "v")
	if err == nil {
		t.Error("expected error for empty configMapName")
	}
}

// ─── UpdateSecretDataKey validation paths ────────────────────────────────────

// TestUpdateSecretDataKey_EmptySecretName covers the secretName == "" path.
func TestUpdateSecretDataKey_EmptySecretName(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateSecretDataKey("default", "", "k", "v")
	if err == nil {
		t.Error("expected error for empty secretName")
	}
}

// TestUpdateSecretDataKey_EmptyKey covers the key == "" path.
func TestUpdateSecretDataKey_EmptyKey(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateSecretDataKey("default", "sec1", "", "v")
	if err == nil {
		t.Error("expected error for empty key")
	}
}

// ─── checkContainersConfigMapRef – init container path ───────────────────────

// TestCheckContainersConfigMapRef_InitContainerEnvFrom exercises the init-container
// branch in checkContainersConfigMapRef via EnvFrom source.
func TestCheckContainersConfigMapRef_InitContainerEnvFrom(t *testing.T) {
	spec := corev1.PodSpec{
		InitContainers: []corev1.Container{{
			Name:  "init-c",
			Image: "busybox",
			EnvFrom: []corev1.EnvFromSource{{
				ConfigMapRef: &corev1.ConfigMapEnvSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: "mymap"},
				},
			}},
		}},
		Containers: []corev1.Container{{Name: "main", Image: "busybox"}},
	}
	ok, why := checkContainersConfigMapRef(spec, "mymap")
	if !ok {
		t.Fatal("expected match via init container")
	}
	if why == "" {
		t.Error("expected non-empty RefType")
	}
}

// TestCheckContainerConfigMapRef_EnvKeyRef exercises the Env[].ValueFrom.ConfigMapKeyRef
// branch in checkContainerConfigMapRef.
func TestCheckContainerConfigMapRef_EnvKeyRef(t *testing.T) {
	c := corev1.Container{
		Name:  "app",
		Image: "busybox",
		Env: []corev1.EnvVar{{
			Name: "MY_KEY",
			ValueFrom: &corev1.EnvVarSource{
				ConfigMapKeyRef: &corev1.ConfigMapKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: "mymap"},
					Key:                  "some-key",
				},
			},
		}},
	}
	ok, why := checkContainerConfigMapRef(c, "mymap")
	if !ok {
		t.Fatal("expected match via Env key ref")
	}
	if why == "" {
		t.Error("expected non-empty RefType")
	}
}

// ─── checkContainerSecretRef – Env key ref path ──────────────────────────────

// TestCheckContainerSecretRef_EnvKeyRef exercises the Env[].ValueFrom.SecretKeyRef
// branch in checkContainerSecretRef.
func TestCheckContainerSecretRef_EnvKeyRef(t *testing.T) {
	c := corev1.Container{
		Name:  "app",
		Image: "busybox",
		Env: []corev1.EnvVar{{
			Name: "MY_KEY",
			ValueFrom: &corev1.EnvVarSource{
				SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: "mysec"},
					Key:                  "some-key",
				},
			},
		}},
	}
	ok, why := checkContainerSecretRef(c, "mysec")
	if !ok {
		t.Fatal("expected match via Env key ref")
	}
	if why == "" {
		t.Error("expected non-empty RefType")
	}
}

// ─── Startup loadConfig error path ───────────────────────────────────────────

// TestStartup_LoadConfigError verifies that Startup continues gracefully when
// the config file contains invalid JSON (loadConfig returns an error).
func TestStartup_LoadConfigError(t *testing.T) {

	dir := t.TempDir()
	configPath := filepath.Join(dir, "bad-config.json")
	if err := os.WriteFile(configPath, []byte(`{invalid json`), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{
		configPath:           configPath,
		countsRefreshCh:      make(chan struct{}, 1),
		disableStartupDocker: true,
		logCancels:           make(map[string]context.CancelFunc),
		swarmVolumeHelpers:   make(map[string]string),
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Startup should not panic even when loadConfig fails.
	app.Startup(ctx)
	// ctx should be set on the app.
	if app.ctx == nil {
		t.Error("expected app.ctx to be set")
	}
}

// ─── GetOverview error / empty clientset path ────────────────────────────────

// TestGetOverview_EmptyClientset verifies GetOverview returns a zero-count
// OverviewInfo when no resources exist in the fake clientset.
func TestGetOverview_EmptyClientset(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	info, err := app.GetOverview("default")
	if err != nil {
		t.Fatalf("GetOverview() error = %v", err)
	}
	if info.Pods != 0 || info.Deployments != 0 || info.Jobs != 0 {
		t.Errorf("expected all zeros, got %+v", info)
	}
}

// ─── copyFile error paths ─────────────────────────────────────────────────────

// TestCopyFile_WriteError verifies that copyFile returns an error when the
// destination directory is not writable. On Windows this requires a non-existent
// parent path inside a temp dir.
func TestCopyFile_DestCreateError(t *testing.T) {
	dir := t.TempDir()
	srcPath := filepath.Join(dir, "src.txt")
	if err := os.WriteFile(srcPath, []byte("data"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}
	// Use a destination whose parent is an existing FILE (not a dir) so MkdirAll
	// will fail when trying to create it.
	bogusParent := filepath.Join(dir, "src.txt", "nested", "dst.txt")

	err := copyFile(srcPath, bogusParent)
	if err == nil {
		t.Error("expected error when destination parent is not a directory")
	}
}

// ─── GetCustomResourceDefinitionDetail – not found path ──────────────────────

func TestGetCustomResourceDefinitionDetail_EmptyNameExtra(t *testing.T) {
	app := &App{ctx: context.Background()}
	_, err := app.GetCustomResourceDefinitionDetail("")
	if err == nil {
		t.Error("expected error for empty name")
	}
}
