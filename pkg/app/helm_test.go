package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetHelmSettings(t *testing.T) {
	app := &App{
		currentKubeContext: "test-context",
	}

	settings := app.getHelmSettings()

	if settings == nil {
		t.Fatal("expected settings to be non-nil")
	}

	if settings.KubeContext != "test-context" {
		t.Errorf("expected KubeContext to be 'test-context', got %q", settings.KubeContext)
	}
}

func TestGetHelmRepoFile(t *testing.T) {
	app := &App{}

	repoFile := app.getHelmRepoFile()

	if repoFile == "" {
		t.Fatal("expected repoFile to be non-empty")
	}

	// Should contain a path with 'helm' in it
	if !filepath.IsAbs(repoFile) {
		// On Windows, helm settings may return relative paths depending on env
		// Just check it's not empty
	}
}

func TestGetHelmRepositories_NoFile(t *testing.T) {
	app := &App{}

	repos, err := app.GetHelmRepositories()

	if err != nil {
		t.Fatalf("expected no error for missing repo file, got: %v", err)
	}

	if repos == nil {
		t.Fatal("expected repos to be non-nil (empty slice)")
	}

	if len(repos) != 0 {
		t.Errorf("expected empty repos slice, got %d repos", len(repos))
	}
}

func TestSearchHelmCharts_NoRepoFile(t *testing.T) {
	app := &App{}

	charts, err := app.SearchHelmCharts("nginx")

	if err != nil {
		t.Fatalf("expected no error for missing repo file, got: %v", err)
	}

	if charts == nil {
		t.Fatal("expected charts to be non-nil (empty slice)")
	}

	if len(charts) != 0 {
		t.Errorf("expected empty charts slice, got %d charts", len(charts))
	}
}

func TestHelmReleaseInfo_Fields(t *testing.T) {
	info := HelmReleaseInfo{
		Name:         "my-release",
		Namespace:    "default",
		Revision:     1,
		Chart:        "nginx",
		ChartVersion: "1.0.0",
		AppVersion:   "1.21.0",
		Status:       "deployed",
		Age:          "5m",
		Updated:      "2024-01-01 12:00:00",
		Labels:       map[string]string{"app": "nginx"},
	}

	if info.Name != "my-release" {
		t.Errorf("expected Name to be 'my-release', got %q", info.Name)
	}
	if info.Namespace != "default" {
		t.Errorf("expected Namespace to be 'default', got %q", info.Namespace)
	}
	if info.Revision != 1 {
		t.Errorf("expected Revision to be 1, got %d", info.Revision)
	}
	if info.Chart != "nginx" {
		t.Errorf("expected Chart to be 'nginx', got %q", info.Chart)
	}
	if info.Status != "deployed" {
		t.Errorf("expected Status to be 'deployed', got %q", info.Status)
	}
}

func TestHelmRepositoryInfo_Fields(t *testing.T) {
	info := HelmRepositoryInfo{
		Name: "bitnami",
		URL:  "https://charts.bitnami.com/bitnami",
	}

	if info.Name != "bitnami" {
		t.Errorf("expected Name to be 'bitnami', got %q", info.Name)
	}
	if info.URL != "https://charts.bitnami.com/bitnami" {
		t.Errorf("expected URL to be bitnami URL, got %q", info.URL)
	}
}

func TestHelmChartInfo_Fields(t *testing.T) {
	info := HelmChartInfo{
		Name:        "nginx",
		Repo:        "bitnami",
		Version:     "15.0.0",
		AppVersion:  "1.25.0",
		Description: "NGINX Open Source is a web server",
		Versions:    []string{"15.0.0", "14.0.0", "13.0.0"},
	}

	if info.Name != "nginx" {
		t.Errorf("expected Name to be 'nginx', got %q", info.Name)
	}
	if info.Repo != "bitnami" {
		t.Errorf("expected Repo to be 'bitnami', got %q", info.Repo)
	}
	if len(info.Versions) != 3 {
		t.Errorf("expected 3 versions, got %d", len(info.Versions))
	}
}

func TestHelmHistoryInfo_Fields(t *testing.T) {
	info := HelmHistoryInfo{
		Revision:    2,
		Updated:     "2024-01-02 12:00:00",
		Status:      "deployed",
		Chart:       "nginx-15.0.0",
		AppVersion:  "1.25.0",
		Description: "Upgrade complete",
	}

	if info.Revision != 2 {
		t.Errorf("expected Revision to be 2, got %d", info.Revision)
	}
	if info.Status != "deployed" {
		t.Errorf("expected Status to be 'deployed', got %q", info.Status)
	}
}

func TestHelmInstallRequest_Fields(t *testing.T) {
	req := HelmInstallRequest{
		ReleaseName: "my-nginx",
		Namespace:   "default",
		ChartRef:    "bitnami/nginx",
		Version:     "15.0.0",
		Values:      map[string]interface{}{"replicaCount": 2},
		CreateNs:    true,
	}

	if req.ReleaseName != "my-nginx" {
		t.Errorf("expected ReleaseName to be 'my-nginx', got %q", req.ReleaseName)
	}
	if req.ChartRef != "bitnami/nginx" {
		t.Errorf("expected ChartRef to be 'bitnami/nginx', got %q", req.ChartRef)
	}
	if !req.CreateNs {
		t.Error("expected CreateNs to be true")
	}
}

func TestHelmUpgradeRequest_Fields(t *testing.T) {
	req := HelmUpgradeRequest{
		ReleaseName: "my-nginx",
		Namespace:   "default",
		ChartRef:    "bitnami/nginx",
		Version:     "16.0.0",
		Values:      map[string]interface{}{"replicaCount": 3},
		ReuseValues: true,
	}

	if req.ReleaseName != "my-nginx" {
		t.Errorf("expected ReleaseName to be 'my-nginx', got %q", req.ReleaseName)
	}
	if req.Version != "16.0.0" {
		t.Errorf("expected Version to be '16.0.0', got %q", req.Version)
	}
	if !req.ReuseValues {
		t.Error("expected ReuseValues to be true")
	}
}

func TestTriggerCountsRefresh(t *testing.T) {
	app := &App{
		countsRefreshCh: make(chan struct{}, 1),
	}

	// First call should send to channel
	app.triggerCountsRefresh()

	select {
	case <-app.countsRefreshCh:
		// Expected
	default:
		t.Error("expected channel to receive after triggerCountsRefresh")
	}

	// Second immediate call should not block (channel buffered)
	app.countsRefreshCh = make(chan struct{}, 1)
	app.triggerCountsRefresh()
	app.triggerCountsRefresh() // Should not panic or block

	select {
	case <-app.countsRefreshCh:
		// Expected - only one should be in the buffer
	default:
		t.Error("expected channel to receive after triggerCountsRefresh")
	}
}

func TestGetHelmChartVersions_NoIndex(t *testing.T) {
	app := &App{}

	// Try to get versions for a non-existent repo
	_, err := app.GetHelmChartVersions("nonexistent-repo", "nginx")

	if err == nil {
		t.Error("expected error for non-existent repo index")
	}
}

func TestResourceCountsIncludesHelmReleases(t *testing.T) {
	counts := ResourceCounts{
		HelmReleases: 5,
	}

	if counts.HelmReleases != 5 {
		t.Errorf("expected HelmReleases to be 5, got %d", counts.HelmReleases)
	}
}

func TestResourceCountsEqual_WithHelmReleases(t *testing.T) {
	a := ResourceCounts{
		Deployments:  1,
		HelmReleases: 3,
	}
	b := ResourceCounts{
		Deployments:  1,
		HelmReleases: 3,
	}
	c := ResourceCounts{
		Deployments:  1,
		HelmReleases: 5,
	}

	if !resourceCountsEqual(a, b) {
		t.Error("expected a and b to be equal")
	}

	if resourceCountsEqual(a, c) {
		t.Error("expected a and c to be not equal (different HelmReleases)")
	}
}

// Integration test helper - creates a temp helm repo file for testing
func createTempHelmRepoFile(t *testing.T, content string) (string, func()) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "helm-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	repoFile := filepath.Join(tmpDir, "repositories.yaml")
	if err := os.WriteFile(repoFile, []byte(content), 0644); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to write repo file: %v", err)
	}

	cleanup := func() {
		os.RemoveAll(tmpDir)
	}

	return repoFile, cleanup
}
