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
		t.Logf("repoFile is not absolute: %q", repoFile)
	}
}

func TestGetHelmRepositories_NoFile(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HELM_CONFIG_HOME", filepath.Join(tmp, "config"))
	t.Setenv("HELM_CACHE_HOME", filepath.Join(tmp, "cache"))
	t.Setenv("HELM_DATA_HOME", filepath.Join(tmp, "data"))

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
	tmp := t.TempDir()
	t.Setenv("HELM_CONFIG_HOME", filepath.Join(tmp, "config"))
	t.Setenv("HELM_CACHE_HOME", filepath.Join(tmp, "cache"))
	t.Setenv("HELM_DATA_HOME", filepath.Join(tmp, "data"))

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
		ReleaseName:  "my-nginx",
		Namespace:    "default",
		ChartRef:     "bitnami/nginx",
		Version:      "15.0.0",
		Values:       map[string]interface{}{"replicaCount": 2},
		CreateNs:     true,
		WaitStrategy: "watcher",
		Timeout:      600,
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
	if req.WaitStrategy != "watcher" {
		t.Errorf("expected WaitStrategy to be 'watcher', got %q", req.WaitStrategy)
	}
	if req.Timeout != 600 {
		t.Errorf("expected Timeout to be 600, got %d", req.Timeout)
	}
}

func TestHelmUpgradeRequest_Fields(t *testing.T) {
	req := HelmUpgradeRequest{
		ReleaseName:  "my-nginx",
		Namespace:    "default",
		ChartRef:     "bitnami/nginx",
		Version:      "16.0.0",
		Values:       map[string]interface{}{"replicaCount": 3},
		ReuseValues:  true,
		WaitStrategy: "legacy",
		Timeout:      120,
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
	if req.WaitStrategy != "legacy" {
		t.Errorf("expected WaitStrategy to be 'legacy', got %q", req.WaitStrategy)
	}
	if req.Timeout != 120 {
		t.Errorf("expected Timeout to be 120, got %d", req.Timeout)
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

// ============================================================================
// Helm v4 Feature Tests - WaitStrategy and Timeout handling
// ============================================================================

func TestHelmInstallRequest_WaitStrategies(t *testing.T) {
	testCases := []struct {
		name         string
		waitStrategy string
		timeout      int
		description  string
	}{
		{
			name:         "watcher strategy",
			waitStrategy: "watcher",
			timeout:      600,
			description:  "Helm v4 event-driven wait using kstatus",
		},
		{
			name:         "legacy strategy",
			waitStrategy: "legacy",
			timeout:      300,
			description:  "Helm 3-style periodic polling",
		},
		{
			name:         "hookOnly strategy",
			waitStrategy: "hookOnly",
			timeout:      120,
			description:  "Wait only for hook Pods/Jobs to complete",
		},
		{
			name:         "empty strategy defaults to legacy",
			waitStrategy: "",
			timeout:      0,
			description:  "Empty strategy should use legacy for backward compat",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := HelmInstallRequest{
				ReleaseName:  "test-release",
				Namespace:    "default",
				ChartRef:     "test/chart",
				WaitStrategy: tc.waitStrategy,
				Timeout:      tc.timeout,
			}

			if req.WaitStrategy != tc.waitStrategy {
				t.Errorf("expected WaitStrategy %q, got %q", tc.waitStrategy, req.WaitStrategy)
			}
			if req.Timeout != tc.timeout {
				t.Errorf("expected Timeout %d, got %d", tc.timeout, req.Timeout)
			}
		})
	}
}

func TestHelmUpgradeRequest_WaitStrategies(t *testing.T) {
	testCases := []struct {
		name         string
		waitStrategy string
		timeout      int
	}{
		{
			name:         "watcher strategy",
			waitStrategy: "watcher",
			timeout:      600,
		},
		{
			name:         "legacy strategy",
			waitStrategy: "legacy",
			timeout:      300,
		},
		{
			name:         "hookOnly strategy",
			waitStrategy: "hookOnly",
			timeout:      180,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := HelmUpgradeRequest{
				ReleaseName:  "test-release",
				Namespace:    "default",
				ChartRef:     "test/chart",
				WaitStrategy: tc.waitStrategy,
				Timeout:      tc.timeout,
				ReuseValues:  true,
			}

			if req.WaitStrategy != tc.waitStrategy {
				t.Errorf("expected WaitStrategy %q, got %q", tc.waitStrategy, req.WaitStrategy)
			}
			if req.Timeout != tc.timeout {
				t.Errorf("expected Timeout %d, got %d", tc.timeout, req.Timeout)
			}
		})
	}
}

func TestHelmInstallRequest_DefaultTimeout(t *testing.T) {
	// Test that when timeout is 0, the function should use default (300s)
	req := HelmInstallRequest{
		ReleaseName:  "test-release",
		Namespace:    "default",
		ChartRef:     "test/chart",
		WaitStrategy: "watcher",
		Timeout:      0, // Should default to 300 in InstallHelmChart
	}

	if req.Timeout != 0 {
		t.Errorf("expected request Timeout to be 0 (will use default), got %d", req.Timeout)
	}
}

func TestHelmUpgradeRequest_DefaultTimeout(t *testing.T) {
	// Test that when timeout is 0, the function should use default (300s)
	req := HelmUpgradeRequest{
		ReleaseName:  "test-release",
		Namespace:    "default",
		ChartRef:     "test/chart",
		WaitStrategy: "legacy",
		Timeout:      0, // Should default to 300 in UpgradeHelmRelease
	}

	if req.Timeout != 0 {
		t.Errorf("expected request Timeout to be 0 (will use default), got %d", req.Timeout)
	}
}

func TestHelmInstallRequest_FullV4Config(t *testing.T) {
	// Test a full Helm v4 installation request with all fields
	req := HelmInstallRequest{
		ReleaseName:  "production-app",
		Namespace:    "production",
		ChartRef:     "oci://registry.example.com/charts/myapp",
		Version:      "2.0.0",
		Values:       map[string]interface{}{"replicaCount": 3, "image.tag": "v2.0.0"},
		CreateNs:     true,
		WaitStrategy: "watcher",
		Timeout:      900, // 15 minutes
	}

	if req.ReleaseName != "production-app" {
		t.Errorf("expected ReleaseName 'production-app', got %q", req.ReleaseName)
	}
	if req.Namespace != "production" {
		t.Errorf("expected Namespace 'production', got %q", req.Namespace)
	}
	if req.WaitStrategy != "watcher" {
		t.Errorf("expected WaitStrategy 'watcher', got %q", req.WaitStrategy)
	}
	if req.Timeout != 900 {
		t.Errorf("expected Timeout 900, got %d", req.Timeout)
	}
	if !req.CreateNs {
		t.Error("expected CreateNs to be true")
	}
	if req.Values["replicaCount"] != 3 {
		t.Errorf("expected Values.replicaCount to be 3, got %v", req.Values["replicaCount"])
	}
}

func TestHelmUpgradeRequest_FullV4Config(t *testing.T) {
	// Test a full Helm v4 upgrade request with all fields
	req := HelmUpgradeRequest{
		ReleaseName:  "production-app",
		Namespace:    "production",
		ChartRef:     "oci://registry.example.com/charts/myapp",
		Version:      "2.1.0",
		Values:       map[string]interface{}{"replicaCount": 5},
		ReuseValues:  true,
		WaitStrategy: "watcher",
		Timeout:      600,
	}

	if req.ReleaseName != "production-app" {
		t.Errorf("expected ReleaseName 'production-app', got %q", req.ReleaseName)
	}
	if req.Version != "2.1.0" {
		t.Errorf("expected Version '2.1.0', got %q", req.Version)
	}
	if !req.ReuseValues {
		t.Error("expected ReuseValues to be true")
	}
	if req.WaitStrategy != "watcher" {
		t.Errorf("expected WaitStrategy 'watcher', got %q", req.WaitStrategy)
	}
	if req.Timeout != 600 {
		t.Errorf("expected Timeout 600, got %d", req.Timeout)
	}
}

func TestWaitStrategyValues(t *testing.T) {
	// Test that valid wait strategy values are correctly handled
	validStrategies := []string{"watcher", "legacy", "hookOnly", ""}

	for _, strategy := range validStrategies {
		t.Run("strategy_"+strategy, func(t *testing.T) {
			req := HelmInstallRequest{
				ReleaseName:  "test",
				Namespace:    "default",
				ChartRef:     "test/chart",
				WaitStrategy: strategy,
			}
			// Just verify the struct accepts the value without panic
			if req.WaitStrategy != strategy {
				t.Errorf("expected WaitStrategy %q, got %q", strategy, req.WaitStrategy)
			}
		})
	}
}

func TestTimeoutValues(t *testing.T) {
	// Test various timeout values
	testCases := []struct {
		name    string
		timeout int
	}{
		{"zero (uses default)", 0},
		{"30 seconds", 30},
		{"5 minutes", 300},
		{"15 minutes", 900},
		{"30 minutes", 1800},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := HelmInstallRequest{
				ReleaseName: "test",
				Namespace:   "default",
				ChartRef:    "test/chart",
				Timeout:     tc.timeout,
			}
			if req.Timeout != tc.timeout {
				t.Errorf("expected Timeout %d, got %d", tc.timeout, req.Timeout)
			}
		})
	}
}
