package app

import (
	"fmt"
	"net"
	"strings"
	"time"

	"gowails/pkg/app/holmesgpt"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

	// Step 1: Add/update the Robusta Helm repository (10%)
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

	// Holmes uses additionalEnvVars to set the OPENAI_API_KEY
	// LiteLLM automatically picks up OPENAI_API_KEY from the environment for OpenAI models
	// See https://holmesgpt.dev/reference/helm-configuration/
	values := map[string]interface{}{
		"additionalEnvVars": []map[string]interface{}{
			{
				"name": "OPENAI_API_KEY",
				"valueFrom": map[string]interface{}{
					"secretKeyRef": map[string]interface{}{
						"name": holmesOpenAISecretName,
						"key":  holmesOpenAISecretKey,
					},
				},
			},
		},
		// Configure gpt-5.1 as the default model using environment variable for API key
		// LiteLLM reads OPENAI_API_KEY from env automatically when api_key is prefixed with os.environ/
		"modelList": map[string]interface{}{
			"gpt-5.1": map[string]interface{}{
				"api_key":     "os.environ/OPENAI_API_KEY",
				"model":       "openai/gpt-5.1",
				"temperature": 0,
			},
		},
	}

	// Step 4: Install the Helm chart (60%)
	status.Message = "Installing HolmesGPT chart..."
	status.Progress = 60
	a.emitHolmesDeploymentStatus(status)

	installReq := HelmInstallRequest{
		ReleaseName: releaseName,
		Namespace:   namespace,
		ChartRef:    holmesChartName,
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
	actionConfig, err := a.getHelmActionConfig(req.Namespace)
	if err != nil {
		return err
	}

	settings := a.getHelmSettings()

	installAction := action.NewInstall(actionConfig)
	installAction.ReleaseName = req.ReleaseName
	installAction.Namespace = req.Namespace
	installAction.CreateNamespace = req.CreateNs
	installAction.Wait = true
	installAction.Timeout = 5 * time.Minute

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
	_, err = installAction.Run(chart, req.Values)
	if err != nil {
		return fmt.Errorf("failed to install chart: %w", err)
	}

	return nil
}

// waitForHolmesReady polls until Holmes is ready or times out
func (a *App) waitForHolmesReady(namespace, releaseName string) (string, error) {
	// Since Helm install with Wait=true already waits for readiness,
	// we just verify the release is in deployed state
	maxAttempts := 30
	for i := 0; i < maxAttempts; i++ {
		releases, err := a.GetHelmReleases(namespace)
		if err == nil {
			for _, rel := range releases {
				if rel.Name == releaseName && rel.Status == "deployed" {
					// Start port-forward to access Holmes from outside the cluster
					endpoint, err := a.StartHolmesPortForward(namespace)
					if err != nil {
						return "", fmt.Errorf("failed to start port-forward: %w", err)
					}
					return endpoint, nil
				}
			}
		}
		time.Sleep(2 * time.Second)
	}

	return "", fmt.Errorf("timed out waiting for Holmes to be ready")
}

// emitHolmesDeploymentStatus emits deployment status to the frontend
func (a *App) emitHolmesDeploymentStatus(status *holmesgpt.HolmesDeploymentStatus) {
	if a.ctx != nil {
		wailsRuntime.EventsEmit(a.ctx, "holmes:deployment:status", status)
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
