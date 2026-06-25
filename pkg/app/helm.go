package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
	"helm.sh/helm/v4/pkg/action"
	"helm.sh/helm/v4/pkg/chart"
	"helm.sh/helm/v4/pkg/chart/loader"
	"helm.sh/helm/v4/pkg/cli"
	"helm.sh/helm/v4/pkg/getter"
	"helm.sh/helm/v4/pkg/kube"
	"helm.sh/helm/v4/pkg/release"
	repo "helm.sh/helm/v4/pkg/repo/v1"
)

// getHelmSettings returns Helm CLI settings configured for the current kubeconfig
func (a *App) getHelmSettings() *cli.EnvSettings {
	settings := cli.New()

	// Use the current kubeconfig path if set
	kubeConfigPath := a.getKubeConfigPath()
	if kubeConfigPath != "" {
		settings.KubeConfig = kubeConfigPath
	}

	// Use the current kube context
	if a.currentKubeContext != "" {
		settings.KubeContext = a.currentKubeContext
	}

	return settings
}

// getHelmActionConfig returns a Helm action configuration for the given namespace
func (a *App) getHelmActionConfig(namespace string) (*action.Configuration, error) {
	settings := a.getHelmSettings()
	actionConfig := new(action.Configuration)

	// Initialize using the CLI settings RESTClientGetter
	// In Helm v4, the Init signature has changed - log handler is configured separately
	if err := actionConfig.Init(
		settings.RESTClientGetter(),
		namespace,
		os.Getenv("HELM_DRIVER"),
	); err != nil {
		return nil, fmt.Errorf("failed to initialize helm action config: %w", err)
	}

	return actionConfig, nil
}

// getHelmRepoFile returns the path to the Helm repositories file
func (a *App) getHelmRepoFile() string {
	settings := a.getHelmSettings()
	return settings.RepositoryConfig
}

// GetHelmReleases returns all Helm releases in the given namespace
func (a *App) GetHelmReleases(namespace string) ([]HelmReleaseInfo, error) {
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	listAction := action.NewList(actionConfig)
	listAction.Deployed = true
	listAction.Failed = true
	listAction.Pending = true
	listAction.Superseded = true
	listAction.Uninstalling = true

	if namespace == "" {
		listAction.AllNamespaces = true
	}

	releases, err := listAction.Run()
	if err != nil {
		return nil, fmt.Errorf("failed to list helm releases: %w", err)
	}

	result := make([]HelmReleaseInfo, 0, len(releases))
	now := time.Now()

	for _, rel := range releases {
		// Use Accessor interface in Helm v4 to access release fields
		accessor, err := release.NewAccessor(rel)
		if err != nil {
			continue // Skip releases we can't access
		}

		age := "-"
		updated := "-"
		deployedAt := accessor.DeployedAt()
		if !deployedAt.IsZero() {
			age = formatDuration(now.Sub(deployedAt))
			updated = deployedAt.Format("2006-01-02 15:04:05")
		}

		chartName := ""
		chartVersion := ""
		appVersion := ""
		if chrt := accessor.Chart(); chrt != nil {
			if chartAccessor, err := chart.NewAccessor(chrt); err == nil {
				chartName = chartAccessor.Name()
				// Get version and appVersion from MetadataAsMap
				if meta := chartAccessor.MetadataAsMap(); meta != nil {
					if v, ok := meta["version"].(string); ok {
						chartVersion = v
					}
					if v, ok := meta["appVersion"].(string); ok {
						appVersion = v
					}
				}
			}
		}

		releaseInfo := HelmReleaseInfo{
			Name:         accessor.Name(),
			Namespace:    accessor.Namespace(),
			Revision:     accessor.Version(),
			Chart:        chartName,
			ChartVersion: chartVersion,
			AppVersion:   appVersion,
			Status:       accessor.Status(),
			Age:          age,
			Updated:      updated,
			Labels:       accessor.Labels(),
		}
		if releaseInfo.Labels == nil {
			releaseInfo.Labels = map[string]string{}
		}
		result = append(result, releaseInfo)
	}

	return result, nil
}

// GetHelmRepositories returns all configured Helm repositories
func (a *App) GetHelmRepositories() ([]HelmRepositoryInfo, error) {
	repoFile := a.getHelmRepoFile()

	// Check if repo file exists
	if _, err := os.Stat(repoFile); os.IsNotExist(err) {
		return []HelmRepositoryInfo{}, nil
	}

	f, err := repo.LoadFile(repoFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load helm repositories: %w", err)
	}

	result := []HelmRepositoryInfo{}
	for _, r := range f.Repositories {
		result = append(result, HelmRepositoryInfo{
			Name: r.Name,
			URL:  r.URL,
		})
	}

	return result, nil
}

// AddHelmRepository adds a new Helm repository
func (a *App) AddHelmRepository(name, url string) error {
	settings := a.getHelmSettings()
	repoFile := a.getHelmRepoFile()

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(repoFile), 0o750); err != nil {
		return fmt.Errorf("failed to create helm config directory: %w", err)
	}

	// Load existing repos or create new file
	var f *repo.File
	if _, err := os.Stat(repoFile); os.IsNotExist(err) {
		f = repo.NewFile()
	} else {
		f, err = repo.LoadFile(repoFile)
		if err != nil {
			return fmt.Errorf("failed to load helm repositories: %w", err)
		}
	}

	// Create repo entry (will update if exists)
	entry := &repo.Entry{
		Name: name,
		URL:  url,
	}

	// Download and verify the repo index
	r, err := repo.NewChartRepository(entry, getter.All(settings))
	if err != nil {
		return fmt.Errorf("failed to create chart repository: %w", err)
	}

	// Set the cache path for the index file
	r.CachePath = settings.RepositoryCache

	if _, err := r.DownloadIndexFile(); err != nil {
		return fmt.Errorf("failed to download repository index: %w", err)
	}

	// Add or update repo entry and save
	f.Update(entry)
	if err := f.WriteFile(repoFile, 0644); err != nil {
		return fmt.Errorf("failed to save repository file: %w", err)
	}

	return nil
}

// RemoveHelmRepository removes a Helm repository
func (a *App) RemoveHelmRepository(name string) error {
	repoFile := a.getHelmRepoFile()

	f, err := repo.LoadFile(repoFile)
	if err != nil {
		return fmt.Errorf("failed to load helm repositories: %w", err)
	}

	if !f.Remove(name) {
		return fmt.Errorf("repository %q not found", name)
	}

	if err := f.WriteFile(repoFile, 0644); err != nil {
		return fmt.Errorf("failed to save repository file: %w", err)
	}

	return nil
}

// UpdateHelmRepositories updates all Helm repository indexes
func (a *App) UpdateHelmRepositories() error {
	settings := a.getHelmSettings()
	repoFile := a.getHelmRepoFile()

	f, err := repo.LoadFile(repoFile)
	if err != nil {
		return fmt.Errorf("failed to load helm repositories: %w", err)
	}

	var updateErrors []string
	for _, entry := range f.Repositories {
		r, err := repo.NewChartRepository(entry, getter.All(settings))
		if err != nil {
			updateErrors = append(updateErrors, fmt.Sprintf("%s: %v", entry.Name, err))
			continue
		}

		r.CachePath = settings.RepositoryCache

		if _, err := r.DownloadIndexFile(); err != nil {
			updateErrors = append(updateErrors, fmt.Sprintf("%s: %v", entry.Name, err))
		}
	}

	if len(updateErrors) > 0 {
		return fmt.Errorf("failed to update some repositories: %s", strings.Join(updateErrors, "; "))
	}

	return nil
}

// SearchHelmCharts searches for charts in all configured repositories
func (a *App) SearchHelmCharts(keyword string) ([]HelmChartInfo, error) {
	settings := a.getHelmSettings()
	repoFile := a.getHelmRepoFile()

	// Check if repo file exists
	if _, err := os.Stat(repoFile); os.IsNotExist(err) {
		return []HelmChartInfo{}, nil
	}

	f, err := repo.LoadFile(repoFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load helm repositories: %w", err)
	}

	result := []HelmChartInfo{}
	keyword = strings.ToLower(keyword)

	for _, entry := range f.Repositories {
		indexFile := filepath.Join(settings.RepositoryCache, fmt.Sprintf("%s-index.yaml", entry.Name))
		index, err := repo.LoadIndexFile(indexFile)
		if err != nil {
			continue // Skip repos with no index
		}

		for chartName, chartVersions := range index.Entries {
			if keyword != "" && !strings.Contains(strings.ToLower(chartName), keyword) {
				continue
			}

			if len(chartVersions) == 0 {
				continue
			}

			// Get latest version info
			latest := chartVersions[0]

			// Collect all versions
			versions := make([]string, 0, len(chartVersions))
			for _, v := range chartVersions {
				versions = append(versions, v.Version)
			}

			result = append(result, HelmChartInfo{
				Name:        chartName,
				Repo:        entry.Name,
				Version:     latest.Version,
				AppVersion:  latest.AppVersion,
				Description: latest.Description,
				Versions:    versions,
			})
		}
	}

	// Sort by chart name
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result, nil
}

// GetHelmChartVersions returns all versions of a specific chart
func (a *App) GetHelmChartVersions(repoName, chartName string) ([]HelmChartVersionInfo, error) {
	settings := a.getHelmSettings()
	indexFile := filepath.Join(settings.RepositoryCache, fmt.Sprintf("%s-index.yaml", repoName))

	index, err := repo.LoadIndexFile(indexFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load repository index: %w", err)
	}

	chartVersions, ok := index.Entries[chartName]
	if !ok {
		return nil, fmt.Errorf("chart %q not found in repository %q", chartName, repoName)
	}

	result := make([]HelmChartVersionInfo, 0, len(chartVersions))
	for _, v := range chartVersions {
		created := "-"
		if !v.Created.IsZero() {
			created = v.Created.Format("2006-01-02 15:04:05")
		}
		result = append(result, HelmChartVersionInfo{
			Version:     v.Version,
			AppVersion:  v.AppVersion,
			Description: v.Description,
			Created:     created,
		})
	}

	return result, nil
}

// InstallHelmChart installs a Helm chart
func (a *App) InstallHelmChart(req HelmInstallRequest) error {
	a.auditf("helm-install", "release/"+req.ReleaseName, "namespace=%s chart=%s", req.Namespace, req.ChartRef)
	actionConfig, err := a.getHelmActionConfig(req.Namespace)
	if err != nil {
		return err
	}

	settings := a.getHelmSettings()

	installAction := action.NewInstall(actionConfig)
	installAction.ReleaseName = req.ReleaseName
	installAction.Namespace = req.Namespace
	installAction.CreateNamespace = req.CreateNs
	if req.Version != "" {
		installAction.Version = req.Version
	}

	// Helm v4: Configure wait strategy using kube.WaitStrategy type
	// Valid values: kube.StatusWatcherStrategy, kube.LegacyStrategy, kube.HookOnlyStrategy
	switch req.WaitStrategy {
	case "watcher":
		installAction.WaitStrategy = kube.StatusWatcherStrategy
	case "hookOnly":
		installAction.WaitStrategy = kube.HookOnlyStrategy
	default:
		// Default to legacy for backward compatibility
		installAction.WaitStrategy = kube.LegacyStrategy
	}

	// Set timeout
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 300 // Default 5 minutes
	}
	installAction.Timeout = time.Duration(timeout) * time.Second

	// Locate and load the chart
	chartPath, err := installAction.ChartPathOptions.LocateChart(req.ChartRef, settings)
	if err != nil {
		return fmt.Errorf("failed to locate chart: %w", err)
	}

	chart, err := loader.Load(chartPath)
	if err != nil {
		return fmt.Errorf("failed to load chart: %w", err)
	}

	// Run the install with context for better control (IMP-1: respect app shutdown)
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	_, err = installAction.RunWithContext(ctx, chart, req.Values)
	if err != nil {
		return fmt.Errorf("failed to install chart: %w", err)
	}

	// Trigger resource counts refresh
	a.triggerCountsRefresh()

	return nil
}

// UpgradeHelmRelease upgrades an existing Helm release
func (a *App) UpgradeHelmRelease(req HelmUpgradeRequest) error {
	actionConfig, err := a.getHelmActionConfig(req.Namespace)
	if err != nil {
		return err
	}

	settings := a.getHelmSettings()

	upgradeAction := action.NewUpgrade(actionConfig)
	upgradeAction.Namespace = req.Namespace
	upgradeAction.ReuseValues = req.ReuseValues
	if req.Version != "" {
		upgradeAction.Version = req.Version
	}

	// Helm v4: Configure wait strategy using kube.WaitStrategy type
	switch req.WaitStrategy {
	case "watcher":
		upgradeAction.WaitStrategy = kube.StatusWatcherStrategy
	case "hookOnly":
		upgradeAction.WaitStrategy = kube.HookOnlyStrategy
	default:
		// Default to legacy for backward compatibility
		upgradeAction.WaitStrategy = kube.LegacyStrategy
	}

	// Set timeout
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 300 // Default 5 minutes
	}
	upgradeAction.Timeout = time.Duration(timeout) * time.Second

	// Locate and load the chart
	chartPath, err := upgradeAction.ChartPathOptions.LocateChart(req.ChartRef, settings)
	if err != nil {
		return fmt.Errorf("failed to locate chart: %w", err)
	}

	chart, err := loader.Load(chartPath)
	if err != nil {
		return fmt.Errorf("failed to load chart: %w", err)
	}

	// Run the upgrade with context (IMP-1: respect app shutdown)
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	_, err = upgradeAction.RunWithContext(ctx, req.ReleaseName, chart, req.Values)
	if err != nil {
		return fmt.Errorf("failed to upgrade release: %w", err)
	}

	// Trigger resource counts refresh
	a.triggerCountsRefresh()

	return nil
}

// UninstallHelmRelease uninstalls a Helm release
func (a *App) UninstallHelmRelease(namespace, releaseName string) error {
	a.auditf("helm-uninstall", "release/"+releaseName, "namespace=%s", namespace)
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return err
	}

	uninstallAction := action.NewUninstall(actionConfig)

	// Helm v4: Configure deletion propagation and wait strategy
	uninstallAction.DeletionPropagation = "foreground"
	uninstallAction.WaitStrategy = kube.StatusWatcherStrategy

	// Run the uninstall
	_, err = uninstallAction.Run(releaseName)
	if err != nil {
		return fmt.Errorf("failed to uninstall release: %w", err)
	}

	// Trigger resource counts refresh
	a.triggerCountsRefresh()

	return nil
}

// RollbackHelmRelease rolls back a Helm release to a previous revision
func (a *App) RollbackHelmRelease(namespace, releaseName string, revision int) error {
	a.auditf("helm-rollback", "release/"+releaseName, "namespace=%s revision=%d", namespace, revision)
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return err
	}

	rollbackAction := action.NewRollback(actionConfig)
	rollbackAction.Version = revision

	err = rollbackAction.Run(releaseName)
	if err != nil {
		return fmt.Errorf("failed to rollback release: %w", err)
	}

	// Trigger resource counts refresh
	a.triggerCountsRefresh()

	return nil
}

// GetHelmReleaseHistory returns the revision history for a Helm release
func (a *App) GetHelmReleaseHistory(namespace, releaseName string) ([]HelmHistoryInfo, error) {
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	historyAction := action.NewHistory(actionConfig)
	historyAction.Max = 256 // Get all revisions

	releases, err := historyAction.Run(releaseName)
	if err != nil {
		return nil, fmt.Errorf("failed to get release history: %w", err)
	}

	var result []HelmHistoryInfo
	for _, rel := range releases {
		// Use Accessor interface in Helm v4 to access release fields
		accessor, err := release.NewAccessor(rel)
		if err != nil {
			continue // Skip releases we can't access
		}

		updated := "-"
		deployedAt := accessor.DeployedAt()
		if !deployedAt.IsZero() {
			updated = deployedAt.Format("2006-01-02 15:04:05")
		}

		chartStr := ""
		appVersion := ""
		if chrt := accessor.Chart(); chrt != nil {
			if chartAccessor, err := chart.NewAccessor(chrt); err == nil {
				chartName := chartAccessor.Name()
				chartVersion := ""
				if meta := chartAccessor.MetadataAsMap(); meta != nil {
					if v, ok := meta["version"].(string); ok {
						chartVersion = v
					}
					if v, ok := meta["appVersion"].(string); ok {
						appVersion = v
					}
				}
				chartStr = fmt.Sprintf("%s-%s", chartName, chartVersion)
			}
		}

		result = append(result, HelmHistoryInfo{
			Revision:    accessor.Version(),
			Updated:     updated,
			Status:      accessor.Status(),
			Chart:       chartStr,
			AppVersion:  appVersion,
			Description: accessor.Notes(), // Notes replaced Description in v4
		})
	}

	// Sort by revision descending (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Revision > result[j].Revision
	})

	return result, nil
}

// GetHelmReleaseValues returns the values for a Helm release
func (a *App) GetHelmReleaseValues(namespace, releaseName string, allValues bool) (string, error) {
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return "", err
	}

	getValuesAction := action.NewGetValues(actionConfig)
	getValuesAction.AllValues = allValues

	values, err := getValuesAction.Run(releaseName)
	if err != nil {
		return "", fmt.Errorf("failed to get release values: %w", err)
	}

	// Convert to YAML
	yamlBytes, err := yaml.Marshal(values)
	if err != nil {
		return "", fmt.Errorf("failed to marshal values to YAML: %w", err)
	}

	return string(yamlBytes), nil
}

// GetHelmReleaseManifest returns the manifest for a Helm release
func (a *App) GetHelmReleaseManifest(namespace, releaseName string) (string, error) {
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return "", err
	}

	getAction := action.NewGet(actionConfig)

	rel, err := getAction.Run(releaseName)
	if err != nil {
		return "", fmt.Errorf("failed to get release: %w", err)
	}

	// Use Accessor interface in Helm v4 to access release fields
	accessor, err := release.NewAccessor(rel)
	if err != nil {
		return "", fmt.Errorf("failed to access release: %w", err)
	}

	return accessor.Manifest(), nil
}

// GetHelmReleaseNotes returns the notes for a Helm release
func (a *App) GetHelmReleaseNotes(namespace, releaseName string) (string, error) {
	actionConfig, err := a.getHelmActionConfig(namespace)
	if err != nil {
		return "", err
	}

	getAction := action.NewGet(actionConfig)

	rel, err := getAction.Run(releaseName)
	if err != nil {
		return "", fmt.Errorf("failed to get release: %w", err)
	}

	// Use Accessor interface in Helm v4 to access release fields
	accessor, err := release.NewAccessor(rel)
	if err != nil {
		return "", fmt.Errorf("failed to access release: %w", err)
	}

	return accessor.Notes(), nil
}

// triggerCountsRefresh signals the counts aggregator to refresh
func (a *App) triggerCountsRefresh() {
	select {
	case a.countsRefreshCh <- struct{}{}:
	default:
		// Channel already has a pending refresh
	}
}


