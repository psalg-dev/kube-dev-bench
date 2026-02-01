package app

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gowails/pkg/app/holmesgpt"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	holmesDefaultNamespace   = "holmesgpt"
	holmesDefaultReleaseName = "holmesgpt"
	holmesServiceName        = "holmesgpt"
	holmesServicePort        = 8080
	holmesHelmRepoName       = "robusta"
	holmesHelmRepoURL        = "https://robusta-charts.storage.googleapis.com"
	holmesChartName          = "robusta/holmes"
	holmesOpenAISecretName   = "holmes-openai"
	holmesOpenAISecretKey    = "openai-api-key"
)

// isE2ETestMode returns true if running in E2E test mode where lightweight deployment is preferred
func isE2ETestMode() bool {
	return os.Getenv("E2E_HOLMES_DEPLOY") == "1"
}

// getHolmesChartReference returns the chart reference to use (local path for E2E, remote chart otherwise)
func getHolmesChartReference() string {
	if isE2ETestMode() {
		// Use local lightweight chart for E2E tests
		// Chart is located at e2e/charts/holmes-mock relative to project root
		cwd, err := os.Getwd()
		if err == nil {
			// Try to find the e2e/charts directory from current working directory
			chartPath := filepath.Join(cwd, "e2e", "charts", "holmes-mock")
			if _, err := os.Stat(chartPath); err == nil {
				return chartPath
			}
			// If not found from cwd, try parent directory (common when running from subdirectories)
			chartPath = filepath.Join(filepath.Dir(cwd), "e2e", "charts", "holmes-mock")
			if _, err := os.Stat(chartPath); err == nil {
				return chartPath
			}
		}
		// Fallback: use relative path and hope helm can find it
		return "./e2e/charts/holmes-mock"
	}
	return holmesChartName
}

// CheckHolmesDeployment checks if HolmesGPT is deployed in the cluster
// Returns deployment status including detected endpoint if deployed
func (a *App) CheckHolmesDeployment() (*holmesgpt.HolmesDeploymentStatus, error) {
	namespace := holmesDefaultNamespace
	releaseName := holmesDefaultReleaseName

	status := &holmesgpt.HolmesDeploymentStatus{
		Phase:       holmesgpt.DeploymentPhaseChecking,
		Message:     "Checking for Holmes deployment...",
		Progress:    0,
		ReleaseName: releaseName,
		Namespace:   namespace,
	}

	// Get helm releases in the holmesgpt namespace
	releases, err := a.GetHelmReleases(namespace)
	if err != nil {
		// Namespace might not exist, which means not deployed
		status.Phase = holmesgpt.DeploymentPhaseNotDeployed
		status.Message = "Holmes is not deployed in this cluster"
		return status, nil
	}

	// Look for holmesgpt release
	for _, rel := range releases {
		if rel.Name == releaseName && (rel.Status == "deployed" || rel.Status == "superseded") {
			// Holmes is deployed, try to detect the endpoint
			endpoint, _ := a.detectHolmesEndpoint(namespace)
			status.Phase = holmesgpt.DeploymentPhaseDeployed
			status.Message = "Holmes is deployed and available"
			status.Progress = 100
			status.Endpoint = endpoint
			return status, nil
		}
		// Check for failed or pending status
		if rel.Name == releaseName {
			status.Phase = holmesgpt.DeploymentPhaseFailed
			status.Message = fmt.Sprintf("Holmes deployment has status: %s", rel.Status)
			status.Error = "Deployment is not in a healthy state"
			return status, nil
		}
	}

	status.Phase = holmesgpt.DeploymentPhaseNotDeployed
	status.Message = "Holmes is not deployed in this cluster"
	return status, nil
}

// detectHolmesEndpoint attempts to find the Holmes service endpoint
// For desktop apps, we need to port-forward since cluster-internal DNS doesn't work
func (a *App) detectHolmesEndpoint(namespace string) (string, error) {
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}

	// Prefer API server proxy (avoids port-forward)
	proxyURL, _, err := a.buildHolmesProxyEndpoint(namespace)
	if err != nil {
		serviceName := holmesServiceName
		servicePort := int32(holmesServicePort)
		if name, port, svcErr := a.findHolmesService(namespace); svcErr == nil {
			serviceName = name
			servicePort = port
		}
		// Fall back to in-cluster DNS (won't work from desktop but stored for reference)
		return fmt.Sprintf("http://%s.%s.svc.cluster.local:%d", serviceName, namespace, servicePort), err
	}
	return proxyURL, nil
}

// DeployHolmesGPT deploys HolmesGPT to the cluster using Helm
// This method emits progress events to the frontend during deployment
func (a *App) DeployHolmesGPT(req holmesgpt.HolmesDeploymentRequest) (*holmesgpt.HolmesDeploymentStatus, error) {
	// Validate request
	if req.OpenAIKey == "" {
		return nil, holmesgpt.ErrOpenAIKeyRequired
	}

	namespace := req.Namespace
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}

	releaseName := req.ReleaseName
	if releaseName == "" {
		releaseName = holmesDefaultReleaseName
	}

	status := &holmesgpt.HolmesDeploymentStatus{
		Phase:       holmesgpt.DeploymentPhaseDeploying,
		Message:     "Starting deployment...",
		Progress:    0,
		ReleaseName: releaseName,
		Namespace:   namespace,
	}

	// Emit initial status
	a.emitHolmesDeploymentStatus(status)

	// Determine which chart to use
	chartRef := getHolmesChartReference()
	useLocalChart := isE2ETestMode()

	// Step 1: Add/update the Robusta Helm repository (10%) - skip for local chart
	if !useLocalChart {
		status.Message = "Adding Robusta Helm repository..."
		status.Progress = 10
		a.emitHolmesDeploymentStatus(status)

		if err := a.AddHelmRepository(holmesHelmRepoName, holmesHelmRepoURL); err != nil {
			status.Phase = holmesgpt.DeploymentPhaseFailed
			status.Message = "Failed to add Helm repository"
			status.Error = err.Error()
			a.emitHolmesDeploymentStatus(status)
			return status, fmt.Errorf("failed to add Robusta repo: %w", err)
		}

		// Step 2: Update Helm repositories (25%)
		status.Message = "Updating Helm repositories..."
		status.Progress = 25
		a.emitHolmesDeploymentStatus(status)

		if err := a.UpdateHelmRepositories(); err != nil {
			// Non-fatal, continue with cached index
			fmt.Printf("Warning: failed to update helm repos: %v\n", err)
		}
	} else {
		fmt.Printf("Using lightweight local chart for E2E testing: %s\n", chartRef)
		status.Message = "Using lightweight chart for testing..."
		status.Progress = 25
		a.emitHolmesDeploymentStatus(status)
	}

	// Step 3: Prepare Helm values (40%)
	status.Message = "Preparing deployment configuration..."
	status.Progress = 40
	a.emitHolmesDeploymentStatus(status)

	// Step 3.5: Ensure OpenAI API key Secret exists (45%)
	status.Message = "Creating OpenAI secret..."
	status.Progress = 45
	a.emitHolmesDeploymentStatus(status)

	if err := a.ensureHolmesOpenAISecret(namespace, req.OpenAIKey); err != nil {
		status.Phase = holmesgpt.DeploymentPhaseFailed
		status.Message = "Failed to create OpenAI secret"
		status.Error = err.Error()
		a.emitHolmesDeploymentStatus(status)
		return status, fmt.Errorf("failed to create OpenAI secret: %w", err)
	}

	// Load default Helm values from embedded YAML file
	// For lightweight chart, use minimal values
	var values map[string]interface{}
	if useLocalChart {
		// Minimal values for lightweight chart
		values = map[string]interface{}{
			"replicaCount": 1,
		}
	} else {
		// See pkg/app/holmesgpt/default-values.yaml for the configuration
		var err error
		values, err = holmesgpt.GetDefaultHelmValues()
		if err != nil {
			status.Phase = holmesgpt.DeploymentPhaseFailed
			status.Message = "Failed to load default Helm values"
			status.Error = err.Error()
			a.emitHolmesDeploymentStatus(status)
			return status, fmt.Errorf("failed to load default Helm values: %w", err)
		}
	}

	// Step 4: Install the Helm chart (60%)
	if useLocalChart {
		status.Message = "Installing lightweight test chart..."
	} else {
		status.Message = "Installing HolmesGPT chart..."
	}
	status.Progress = 60
	a.emitHolmesDeploymentStatus(status)

	installReq := HelmInstallRequest{
		ReleaseName: releaseName,
		Namespace:   namespace,
		ChartRef:    chartRef,
		Values:      values,
		CreateNs:    true,
	}

	if err := a.installHolmesChart(installReq); err != nil {
		status.Phase = holmesgpt.DeploymentPhaseFailed
		status.Message = "Failed to install Holmes chart"
		status.Error = err.Error()
		a.emitHolmesDeploymentStatus(status)
		return status, fmt.Errorf("failed to install Holmes: %w", err)
	}

	// Step 5: Wait for deployment to be ready (80%)
	status.Message = "Waiting for Holmes to be ready..."
	status.Progress = 80
	a.emitHolmesDeploymentStatus(status)

	// Poll for deployment readiness
	endpoint, err := a.waitForHolmesReady(namespace, releaseName)
	if err != nil {
		status.Phase = holmesgpt.DeploymentPhaseFailed
		status.Message = "Holmes deployment did not become ready"
		status.Error = err.Error()
		a.emitHolmesDeploymentStatus(status)
		return status, err
	}

	// Step 6: Configure Holmes in the app (100%)
	status.Message = "Configuring Holmes integration..."
	status.Progress = 95
	a.emitHolmesDeploymentStatus(status)

	// Auto-configure Holmes with the detected endpoint
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:        true,
		Endpoint:       endpoint,
		APIKey:         "", // In-cluster doesn't need separate API key
		ModelKey:       "",
		ResponseFormat: "",
	}

	// Save and initialize
	if err := a.saveConfig(); err != nil {
		fmt.Printf("Warning: failed to save Holmes config: %v\n", err)
	}
	a.initHolmes()

	// Final success status
	status.Phase = holmesgpt.DeploymentPhaseDeployed
	status.Message = "Holmes is now deployed and configured!"
	status.Progress = 100
	status.Endpoint = endpoint
	a.emitHolmesDeploymentStatus(status)

	return status, nil
}

func (a *App) ensureHolmesOpenAISecret(namespace, apiKey string) error {
	if namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if apiKey == "" {
		return fmt.Errorf("OpenAI API key is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      holmesOpenAISecretName,
			Namespace: namespace,
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			holmesOpenAISecretKey: []byte(apiKey),
		},
	}

	existing, err := clientset.CoreV1().Secrets(namespace).Get(a.ctx, holmesOpenAISecretName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			_, err = clientset.CoreV1().Secrets(namespace).Create(a.ctx, secret, metav1.CreateOptions{})
			return err
		}
		return err
	}

	if existing.Data == nil {
		existing.Data = map[string][]byte{}
	}
	existing.Data[holmesOpenAISecretKey] = []byte(apiKey)
	existing.Type = corev1.SecretTypeOpaque

	_, err = clientset.CoreV1().Secrets(namespace).Update(a.ctx, existing, metav1.UpdateOptions{})
	return err
}

// installHolmesChart is a helper to install the Holmes chart with proper settings
func (a *App) installHolmesChart(req HelmInstallRequest) error {
	// Set namespace on settings BEFORE creating actionConfig
	// This ensures the RESTClientGetter uses the correct namespace
	settings := a.getHelmSettings()
	settings.SetNamespace(req.Namespace)
	fmt.Printf("[Holmes] Helm settings: KubeConfig=%s, KubeContext=%s\n", settings.KubeConfig, settings.KubeContext)
	fmt.Printf("[Holmes] Helm namespace from settings: %s\n", settings.Namespace())

	// Create action config with the properly namespaced settings
	actionConfig := new(action.Configuration)
	if err := actionConfig.Init(
		settings.RESTClientGetter(),
		req.Namespace,
		os.Getenv("HELM_DRIVER"),
		func(format string, v ...interface{}) {
			fmt.Printf("[Helm] "+format+"\n", v...)
		},
	); err != nil {
		return fmt.Errorf("failed to initialize helm action config: %w", err)
	}

	// Verify Helm SDK can reach the cluster
	kubeClientSet, err := actionConfig.KubernetesClientSet()
	if err != nil {
		fmt.Printf("[Holmes] ERROR: Failed to get Kubernetes clientset from Helm: %v\n", err)
	} else {
		// Try to list namespaces to verify connection
		nsList, listErr := kubeClientSet.CoreV1().Namespaces().List(a.ctx, metav1.ListOptions{Limit: 5})
		if listErr != nil {
			fmt.Printf("[Holmes] ERROR: Helm K8s client cannot list namespaces: %v\n", listErr)
		} else {
			fmt.Printf("[Holmes] Helm K8s client connected, found %d namespaces\n", len(nsList.Items))
			for _, ns := range nsList.Items {
				fmt.Printf("[Holmes]   - %s\n", ns.Name)
			}
		}
	}

	// Check if release already exists and uninstall it first
	listAction := action.NewList(actionConfig)
	listAction.Deployed = true
	listAction.Failed = true
	listAction.Pending = true
	listAction.Superseded = true
	listAction.Uninstalling = true
	releases, err := listAction.Run()
	fmt.Printf("[Holmes] List releases found %d releases\n", len(releases))
	if err == nil {
		for _, rel := range releases {
			fmt.Printf("[Holmes]   - Release: %s (status: %s)\n", rel.Name, rel.Info.Status.String())
			if rel.Name == req.ReleaseName {
				fmt.Printf("[Holmes] Release %s already exists (status: %s), uninstalling first\n", rel.Name, rel.Info.Status.String())
				uninstallAction := action.NewUninstall(actionConfig)
				uninstallAction.Wait = true
				uninstallAction.Timeout = 60 * time.Second
				_, uninstallErr := uninstallAction.Run(rel.Name)
				if uninstallErr != nil {
					fmt.Printf("[Holmes] Uninstall error (continuing anyway): %v\n", uninstallErr)
				}
				// Wait a moment for resources to be cleaned up
				time.Sleep(2 * time.Second)
				break
			}
		}
	} else {
		fmt.Printf("[Holmes] List releases error: %v\n", err)
	}

	// Ensure namespace exists before upgrade (since Upgrade doesn't have CreateNamespace)
	if req.CreateNs {
		nsClient, nsErr := actionConfig.KubernetesClientSet()
		if nsErr == nil && nsClient != nil {
			_, err := nsClient.CoreV1().Namespaces().Get(a.ctx, req.Namespace, metav1.GetOptions{})
			if err != nil {
				if apierrors.IsNotFound(err) {
					fmt.Printf("[Holmes] Creating namespace %s\n", req.Namespace)
					ns := &corev1.Namespace{
						ObjectMeta: metav1.ObjectMeta{Name: req.Namespace},
					}
					_, createErr := nsClient.CoreV1().Namespaces().Create(a.ctx, ns, metav1.CreateOptions{})
					if createErr != nil {
						fmt.Printf("[Holmes] Warning: failed to create namespace: %v\n", createErr)
					}
				}
			}
		}
	}

	// Use Install action with Replace=true to handle existing releases
	installAction := action.NewInstall(actionConfig)
	installAction.ReleaseName = req.ReleaseName
	installAction.Namespace = req.Namespace
	installAction.CreateNamespace = req.CreateNs
	installAction.Wait = true
	installAction.Timeout = 5 * time.Minute
	installAction.Replace = true       // Replace existing release with same name
	installAction.TakeOwnership = true // Take ownership of existing resources
	installAction.Force = true         // Force resource update

	// Locate and load the chart
	chartPath, err := installAction.ChartPathOptions.LocateChart(req.ChartRef, settings)
	if err != nil {
		return fmt.Errorf("failed to locate chart: %w", err)
	}

	chart, err := loader.Load(chartPath)
	if err != nil {
		return fmt.Errorf("failed to load chart: %w", err)
	}

	// Run the install
	fmt.Printf("[Holmes] Installing chart %s in namespace %s\n", chartPath, req.Namespace)
	fmt.Printf("[Holmes] Chart has %d templates, Name=%s, Version=%s\n", len(chart.Templates), chart.Metadata.Name, chart.Metadata.Version)
	fmt.Printf("[Holmes] Install settings: Wait=%v, Timeout=%v, CreateNamespace=%v, Replace=%v, TakeOwnership=%v, Force=%v\n",
		installAction.Wait, installAction.Timeout, installAction.CreateNamespace, installAction.Replace, installAction.TakeOwnership, installAction.Force)
	fmt.Printf("[Holmes] KubeConfig=%s, KubeContext=%s\n", settings.KubeConfig, settings.KubeContext)

	// Debug: Check if resources already exist BEFORE install
	clientset, preErr := a.getKubernetesInterface()
	if preErr == nil {
		fmt.Printf("[Holmes] PRE-INSTALL CHECK: Checking if resources exist in namespace %s\n", req.Namespace)
		deploysPreCheck, _ := clientset.AppsV1().Deployments(req.Namespace).List(a.ctx, metav1.ListOptions{})
		fmt.Printf("[Holmes] PRE-INSTALL: Deployments found: %d\n", len(deploysPreCheck.Items))
		svcsPreCheck, _ := clientset.CoreV1().Services(req.Namespace).List(a.ctx, metav1.ListOptions{})
		fmt.Printf("[Holmes] PRE-INSTALL: Services found: %d\n", len(svcsPreCheck.Items))
		cmsPreCheck, _ := clientset.CoreV1().ConfigMaps(req.Namespace).List(a.ctx, metav1.ListOptions{})
		fmt.Printf("[Holmes] PRE-INSTALL: ConfigMaps found: %d\n", len(cmsPreCheck.Items))
	}

	release, err := installAction.Run(chart, req.Values)
	if err != nil {
		return fmt.Errorf("failed to install chart: %w", err)
	}

	fmt.Printf("[Holmes] Chart installation complete\n")
	fmt.Printf("[Holmes] Release: Name=%s, Namespace=%s, Status=%s\n", release.Name, release.Namespace, release.Info.Status.String())
	fmt.Printf("[Holmes] Release Description: %s\n", release.Info.Description)
	fmt.Printf("[Holmes] Manifest length: %d bytes\n", len(release.Manifest))
	if len(release.Manifest) > 0 {
		fmt.Printf("[Holmes] Manifest preview (first 500 chars):\n%s\n", release.Manifest[:min(500, len(release.Manifest))])
	}

	// Debug: verify resources were created
	clientset, postErr := a.getKubernetesInterface()
	if postErr == nil {
		deploys, _ := clientset.AppsV1().Deployments(req.Namespace).List(a.ctx, metav1.ListOptions{})
		fmt.Printf("[Holmes] Deployments in %s after install: %d\n", req.Namespace, len(deploys.Items))
		for _, d := range deploys.Items {
			fmt.Printf("[Holmes]   - %s (replicas=%d, ready=%d)\n", d.Name, *d.Spec.Replicas, d.Status.ReadyReplicas)
		}
	}

	return nil
}

// waitForHolmesReady polls until Holmes is ready or times out
func (a *App) waitForHolmesReady(namespace, releaseName string) (string, error) {
	// Wait for the release to be deployed AND for pods to be running
	// Even though Helm install with Wait=true waits for readiness probes,
	// there can be a brief delay before pods are fully running and port-forward succeeds
	maxAttempts := 90 // 3 minutes total (90 * 2s) to handle slow CI environments
	var lastError error
	releaseFound := false

	for i := 0; i < maxAttempts; i++ {
		// Step 1: Check if release is deployed
		if !releaseFound {
			releases, err := a.GetHelmReleases(namespace)
			if err == nil {
				for _, rel := range releases {
					if rel.Name == releaseName && rel.Status == "deployed" {
						releaseFound = true
						fmt.Printf("[Holmes] Release %s found with status: deployed\n", releaseName)
						break
					}
				}
			}
			if !releaseFound {
				time.Sleep(2 * time.Second)
				continue
			}
		}

		// Step 2: Wait for a Running Holmes pod before attempting port-forward
		pods, err := a.GetRunningPods(namespace)
		if err != nil {
			fmt.Printf("[Holmes] Failed to get pods in namespace %s: %v\n", namespace, err)
			time.Sleep(2 * time.Second)
			continue
		}

		var runningPod string
		for _, pod := range pods {
			if (strings.HasPrefix(pod.Name, "holmesgpt") || strings.HasPrefix(pod.Name, "holmes")) && pod.Status == "Running" {
				runningPod = pod.Name
				break
			}
		}

		if runningPod == "" {
			// Log pod states for debugging
			var podStates []string
			for _, pod := range pods {
				if strings.HasPrefix(pod.Name, "holmesgpt") || strings.HasPrefix(pod.Name, "holmes") {
					podStates = append(podStates, fmt.Sprintf("%s:%s", pod.Name, pod.Status))
				}
			}
			if len(podStates) > 0 {
				fmt.Printf("[Holmes] Waiting for Running pod, current states: %v\n", podStates)
			} else {
				fmt.Printf("[Holmes] No Holmes pods found in namespace %s (attempt %d/%d)\n", namespace, i+1, maxAttempts)
			}
			time.Sleep(2 * time.Second)
			continue
		}

		fmt.Printf("[Holmes] Found running pod: %s, attempting port-forward\n", runningPod)

		// Step 3: Start port-forward to access Holmes from outside the cluster
		endpoint, err := a.StartHolmesPortForward(namespace)
		if err != nil {
			lastError = err
			fmt.Printf("[Holmes] Port-forward failed: %v (will retry)\n", err)
			time.Sleep(2 * time.Second)
			continue
		}
		return endpoint, nil
	}

	if lastError != nil {
		return "", fmt.Errorf("timed out waiting for Holmes pods to be ready: %w", lastError)
	}
	return "", fmt.Errorf("timed out waiting for Holmes to be ready")
}

// emitHolmesDeploymentStatus emits deployment status to the frontend
func (a *App) emitHolmesDeploymentStatus(status *holmesgpt.HolmesDeploymentStatus) {
	if a.ctx != nil {
		emitEvent(a.ctx, "holmes:deployment:status", status)
	}
}

// UndeployHolmesGPT removes HolmesGPT from the cluster
func (a *App) UndeployHolmesGPT(namespace, releaseName string) error {
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}
	if releaseName == "" {
		releaseName = holmesDefaultReleaseName
	}

	// Uninstall the Helm release
	if err := a.UninstallHelmRelease(namespace, releaseName); err != nil {
		return fmt.Errorf("failed to uninstall Holmes: %w", err)
	}

	// Clear local Holmes config
	holmesConfig = holmesgpt.DefaultConfig()
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	if err := a.saveConfig(); err != nil {
		fmt.Printf("Warning: failed to save config after undeploying Holmes: %v\n", err)
	}

	return nil
}

// holmesPortForwardLocalPort is the default local port for Holmes port-forward
const holmesPortForwardLocalPort = 18080

// holmesContainerPort is the port Holmes listens on inside the container
const holmesContainerPort = 5050

// StartHolmesPortForward starts a port-forward to the Holmes service in the cluster
// Returns the local URL (http://localhost:18080) that can be used to access Holmes
func (a *App) StartHolmesPortForward(namespace string) (string, error) {
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}

	// Find the Holmes pod
	pods, err := a.GetRunningPods(namespace)
	if err != nil {
		return "", fmt.Errorf("failed to list pods in namespace %s: %w", namespace, err)
	}

	var holmesPod string
	for _, pod := range pods {
		// Look for pods with the holmesgpt label or name prefix
		if len(pod.Name) > 0 && (strings.HasPrefix(pod.Name, "holmesgpt") || strings.HasPrefix(pod.Name, "holmes")) {
			if pod.Status == "Running" {
				holmesPod = pod.Name
				break
			}
		}
	}

	if holmesPod == "" {
		return "", fmt.Errorf("no running Holmes pod found in namespace %s", namespace)
	}

	// Start port-forward to the Holmes pod
	// Holmes API runs on port 5050 inside the container
	localURL, err := a.PortForwardPodWith(namespace, holmesPod, holmesPortForwardLocalPort, holmesContainerPort)
	if err != nil {
		return "", fmt.Errorf("failed to start port-forward to Holmes: %w", err)
	}

	if err := waitForLocalPort("127.0.0.1", holmesPortForwardLocalPort, 12*time.Second); err != nil {
		_ = a.StopPortForward(namespace, holmesPod, holmesPortForwardLocalPort)
		return "", fmt.Errorf("Holmes port-forward not ready: %w", err)
	}

	return localURL, nil
}

func waitForLocalPort(host string, port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("%s:%d", host, port)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for %s", addr)
}

// StopHolmesPortForward stops the Holmes port-forward if active
func (a *App) StopHolmesPortForward(namespace string) error {
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}

	// Find the Holmes pod to stop port-forward
	pods, err := a.GetRunningPods(namespace)
	if err != nil {
		return nil // Ignore if we can't list pods
	}

	for _, pod := range pods {
		if strings.HasPrefix(pod.Name, "holmesgpt") || strings.HasPrefix(pod.Name, "holmes") {
			_ = a.StopPortForward(namespace, pod.Name, holmesPortForwardLocalPort)
		}
	}

	return nil
}
