package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"syscall"
	"time"

	"gowails/pkg/app/holmesgpt"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
)

func buildHolmesClientConfig(config holmesgpt.HolmesConfigData, transport http.RoundTripper) holmesgpt.HolmesConfig {
	clientConfig := holmesgpt.HolmesConfig{
		Endpoint:  config.Endpoint,
		APIKey:    config.APIKey,
		ModelKey:  config.ModelKey,
		Transport: transport,
	}
	if config.ResponseFormat != "" && json.Valid([]byte(config.ResponseFormat)) {
		clientConfig.ResponseFormat = json.RawMessage(config.ResponseFormat)
	}
	return clientConfig
}

// holmesClient is the HolmesGPT client instance
var holmesClient *holmesgpt.HolmesClient
var holmesMu sync.RWMutex

var holmesStreamCancels = map[string]context.CancelFunc{}
var holmesStreamMu sync.Mutex

// holmesConfig holds the Holmes configuration
var holmesConfig = holmesgpt.DefaultConfig()

func isLocalHolmesEndpoint(endpoint string) bool {
	if endpoint == "" {
		return false
	}
	parsed, err := url.Parse(endpoint)
	if err == nil {
		host := parsed.Hostname()
		if host == "localhost" || host == "127.0.0.1" || host == "::1" {
			return true
		}
	}
	endpointLower := strings.ToLower(endpoint)
	return strings.Contains(endpointLower, "localhost") ||
		strings.Contains(endpointLower, "127.0.0.1") ||
		strings.Contains(endpointLower, "[::1]")
}

func isConnectionRefused(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, syscall.ECONNREFUSED) {
		return true
	}
	var netErr *net.OpError
	if errors.As(err, &netErr) {
		if errors.Is(netErr.Err, syscall.ECONNREFUSED) {
			return true
		}
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "connection refused") || strings.Contains(msg, "connectex")
}

func isTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "context deadline exceeded") || strings.Contains(msg, "timeout")
}

func (a *App) tryReconnectHolmesOnRefused(err error, endpoint string) bool {
	if !isConnectionRefused(err) || !isLocalHolmesEndpoint(endpoint) {
		return false
	}
	status, _ := a.ReconnectHolmes()
	return status != nil && status.Connected
}

// isInClusterEndpoint checks if the endpoint is a Kubernetes in-cluster DNS name
// which won't work from a desktop app running outside the cluster
func isInClusterEndpoint(endpoint string) bool {
	return strings.Contains(endpoint, ".svc.cluster.local")
}

func isKubeProxyEndpoint(endpoint string) bool {
	lower := strings.ToLower(endpoint)
	return strings.Contains(lower, "/api/v1/namespaces/") &&
		strings.Contains(lower, "/services/http:") &&
		strings.Contains(lower, "/proxy")
}

func isHolmesServiceNotFound(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "services \"") && strings.Contains(msg, "not found")
}

func holmesNamespaceFromEndpoint(endpoint string) string {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return holmesDefaultNamespace
	}
	host := parsed.Hostname()
	parts := strings.Split(host, ".")
	if len(parts) >= 2 {
		return parts[1]
	}
	return holmesDefaultNamespace
}

func holmesNamespaceFromProxyEndpoint(endpoint string) string {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return holmesDefaultNamespace
	}
	parts := strings.Split(parsed.Path, "/")
	for i := 0; i < len(parts)-1; i++ {
		if parts[i] == "namespaces" && i+1 < len(parts) {
			if parts[i+1] != "" {
				return parts[i+1]
			}
		}
	}
	return holmesDefaultNamespace
}

func buildHolmesProxyURL(apiHost string, namespace string, serviceName string, servicePort int32) (string, error) {
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}
	if serviceName == "" {
		serviceName = holmesServiceName
	}
	if servicePort == 0 {
		servicePort = holmesServicePort
	}
	u, err := url.Parse(apiHost)
	if err != nil {
		return "", err
	}
	proxyPath := path.Join("/", u.Path, "api", "v1", "namespaces", namespace, "services", fmt.Sprintf("http:%s:%d", serviceName, servicePort), "proxy")
	u.Path = proxyPath
	return strings.TrimRight(u.String(), "/"), nil
}

func (a *App) findHolmesService(namespace string) (string, int32, error) {
	if namespace == "" {
		namespace = holmesDefaultNamespace
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", 0, err
	}

	svcs, err := clientset.CoreV1().Services(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return "", 0, err
	}

	type candidate struct {
		name  string
		port  int32
		score int
	}

	best := candidate{}
	for _, svc := range svcs.Items {
		if len(svc.Spec.Ports) == 0 {
			continue
		}

		labels := svc.Labels
		score := 0
		nameLower := strings.ToLower(svc.Name)
		if svc.Name == holmesDefaultReleaseName || svc.Name == holmesServiceName {
			score += 6
		}
		if strings.Contains(nameLower, "holmes") {
			score += 3
		}
		if labels["app.kubernetes.io/instance"] == holmesDefaultReleaseName {
			score += 6
		}
		switch strings.ToLower(labels["app.kubernetes.io/name"]) {
		case "holmes", "holmesgpt":
			score += 5
		}
		if strings.Contains(strings.ToLower(labels["app.kubernetes.io/component"]), "api") {
			score += 2
		}

		port := int32(0)
		portName := ""
		for _, p := range svc.Spec.Ports {
			candidateName := strings.ToLower(p.Name)
			if candidateName == "http" || candidateName == "api" {
				port = p.Port
				portName = candidateName
				break
			}
			if p.Port == 8080 || p.Port == 5050 {
				port = p.Port
				portName = candidateName
			}
		}
		if port == 0 {
			port = svc.Spec.Ports[0].Port
			portName = strings.ToLower(svc.Spec.Ports[0].Name)
		}

		if port == 8080 || port == 5050 {
			score += 2
		}
		if portName == "http" {
			score += 2
		}

		if score > best.score {
			best = candidate{name: svc.Name, port: port, score: score}
		}
	}

	if best.name == "" || best.port == 0 {
		return "", 0, fmt.Errorf("no Holmes service found in namespace %s", namespace)
	}

	return best.name, best.port, nil
}

func (a *App) getHolmesProxyTransport() (http.RoundTripper, error) {
	restConfig, err := a.getRESTConfig()
	if err != nil {
		return nil, err
	}
	transport, err := rest.TransportFor(restConfig)
	if err != nil {
		return nil, err
	}
	return transport, nil
}

func (a *App) tryReconnectHolmesOnProxyNotFound(err error, endpoint string) bool {
	if !isKubeProxyEndpoint(endpoint) || !isHolmesServiceNotFound(err) {
		return false
	}
	status, _ := a.ReconnectHolmes()
	return status != nil && status.Connected
}

func (a *App) ensureHolmesPortForward(endpoint string) error {
	if !isKubeProxyEndpoint(endpoint) {
		return fmt.Errorf("endpoint is not a kube proxy URL")
	}

	namespace := holmesNamespaceFromProxyEndpoint(endpoint)
	localURL, pfErr := a.StartHolmesPortForward(namespace)
	if pfErr != nil {
		return pfErr
	}

	holmesConfig.Endpoint = localURL
	holmesConfig.Enabled = true

	client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(holmesConfig, nil))
	if err != nil {
		return err
	}
	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()

	_ = a.saveConfig()
	return nil
}

func (a *App) buildHolmesProxyEndpoint(namespace string) (string, http.RoundTripper, error) {
	restConfig, err := a.getRESTConfig()
	if err != nil {
		return "", nil, err
	}
	serviceName, servicePort, err := a.findHolmesService(namespace)
	if err != nil {
		return "", nil, err
	}
	endpoint, err := buildHolmesProxyURL(restConfig.Host, namespace, serviceName, servicePort)
	if err != nil {
		return "", nil, err
	}
	transport, err := rest.TransportFor(restConfig)
	if err != nil {
		return "", nil, err
	}
	return endpoint, transport, nil
}

// initHolmes initializes the Holmes client if configured
// If the endpoint is an in-cluster URL, it will try to establish a port-forward
func (a *App) initHolmes() {
	log := holmesgpt.GetLogger()

	// Initialize the logger - write to the KubeDevBench logs directory
	if err := holmesgpt.InitLogger(""); err != nil {
		fmt.Printf("Warning: failed to initialize Holmes logger: %v\n", err)
	}

	log.Info("initHolmes: starting initialization")

	if !holmesConfig.IsConfigured() {
		log.Info("initHolmes: Holmes not configured, skipping")
		return
	}

	log.Info("initHolmes: Holmes is configured",
		"endpoint", holmesConfig.Endpoint,
		"enabled", holmesConfig.Enabled)

	endpoint := holmesConfig.Endpoint
	var transport http.RoundTripper

	// If the endpoint is an in-cluster URL, use the API server proxy instead of port-forward
	if isInClusterEndpoint(endpoint) {
		log.Info("initHolmes: endpoint is in-cluster, attempting API server proxy",
			"endpoint", endpoint)
		namespace := holmesNamespaceFromEndpoint(endpoint)
		newEndpoint, newTransport, err := a.buildHolmesProxyEndpoint(namespace)
		if err != nil {
			log.Error("initHolmes: failed to build proxy endpoint",
				"error", err)
			fmt.Printf("Failed to build Holmes proxy endpoint: %v\n", err)
			fmt.Printf("Holmes will not be available until you fix kube access and click Reconnect in the UI\n")
			return
		}
		endpoint = newEndpoint
		transport = newTransport
		holmesConfig.Endpoint = endpoint
		_ = a.saveConfig() // Save the API server proxy endpoint
		log.Info("initHolmes: API server proxy established",
			"endpoint", endpoint)
	} else if isKubeProxyEndpoint(endpoint) {
		log.Info("initHolmes: endpoint is kube proxy, refreshing",
			"endpoint", endpoint)
		namespace := holmesNamespaceFromProxyEndpoint(endpoint)
		newEndpoint, newTransport, err := a.buildHolmesProxyEndpoint(namespace)
		if err != nil {
			log.Warn("initHolmes: failed to refresh proxy endpoint, using fallback",
				"error", err)
			fmt.Printf("Failed to refresh Holmes proxy endpoint: %v\n", err)
			fallbackTransport, terr := a.getHolmesProxyTransport()
			if terr != nil {
				log.Error("initHolmes: failed to build fallback transport",
					"error", terr)
				fmt.Printf("Failed to build Holmes proxy transport: %v\n", terr)
				return
			}
			transport = fallbackTransport
		} else {
			endpoint = newEndpoint
			transport = newTransport
			holmesConfig.Endpoint = endpoint
			_ = a.saveConfig()
			log.Info("initHolmes: proxy endpoint refreshed",
				"endpoint", endpoint)
		}
	} else {
		log.Info("initHolmes: using direct endpoint",
			"endpoint", endpoint)
	}

	log.Debug("initHolmes: creating Holmes client")
	client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(holmesConfig, transport))
	if err != nil {
		log.Error("initHolmes: failed to create client",
			"error", err)
		fmt.Printf("Failed to initialize Holmes client: %v\n", err)
		return
	}
	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()
	log.Info("initHolmes: Holmes client initialized successfully",
		"endpoint", endpoint)
}

// AskHolmes sends a question to HolmesGPT and returns the response.
// This is a Wails RPC method callable from the frontend.
func (a *App) AskHolmes(question string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()
	questionLen := len(question)

	log.Info("AskHolmes: starting",
		"questionLen", questionLen)

	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		log.Error("AskHolmes: Holmes client not configured")
		return nil, holmesgpt.ErrNotConfigured
	}

	log.Debug("AskHolmes: calling client.Ask",
		"endpoint", client.GetEndpoint())

	response, err := client.Ask(question)
	if err != nil && (a.tryReconnectHolmesOnRefused(err, client.GetEndpoint()) || a.tryReconnectHolmesOnProxyNotFound(err, client.GetEndpoint())) {
		log.Warn("AskHolmes: reconnecting after connection issue",
			"error", err)
		holmesMu.RLock()
		client = holmesClient
		holmesMu.RUnlock()
		if client == nil {
			log.Error("AskHolmes: client nil after reconnect")
			return nil, holmesgpt.ErrNotConfigured
		}
		log.Info("AskHolmes: retrying after reconnect")
		return client.Ask(question)
	}

	if err != nil && isTimeoutError(err) && isKubeProxyEndpoint(client.GetEndpoint()) {
		log.Warn("AskHolmes: timeout on kube proxy, trying port-forward",
			"error", err,
			"elapsed", time.Since(startTime))
		if pfErr := a.ensureHolmesPortForward(client.GetEndpoint()); pfErr != nil {
			log.Error("AskHolmes: port-forward failed",
				"error", pfErr)
			return nil, fmt.Errorf("Holmes proxy timed out; port-forward failed: %w", pfErr)
		}
		holmesMu.RLock()
		client = holmesClient
		holmesMu.RUnlock()
		if client == nil {
			return nil, holmesgpt.ErrNotConfigured
		}
		log.Info("AskHolmes: retrying with port-forward")
		return client.Ask(question)
	}

	if err != nil {
		log.Error("AskHolmes: request failed",
			"error", err,
			"elapsed", time.Since(startTime))
	} else {
		log.Info("AskHolmes: completed successfully",
			"responseLen", len(response.Response),
			"totalDuration", time.Since(startTime))
	}

	return response, err
}

// AnalyzePod gathers pod context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzePod(namespace, name string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzePod: starting",
		"namespace", namespace,
		"name", name)

	log.Debug("AnalyzePod: gathering pod context")
	ctx, err := a.getPodContext(namespace, name)
	if err != nil {
		log.Error("AnalyzePod: failed to get pod context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get pod context: %w", err)
	}
	log.Info("AnalyzePod: pod context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes pod and explain any issues:\n\nPod: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzePod: sending to Holmes",
		"questionLen", len(question))

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzePod: analysis failed",
			"error", err,
			"totalDuration", time.Since(startTime))
	} else {
		log.Info("AnalyzePod: completed",
			"responseLen", len(resp.Response),
			"totalDuration", time.Since(startTime))
	}
	return resp, err
}

// AnalyzeDeployment gathers deployment context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeDeployment(namespace, name string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeDeployment: starting",
		"namespace", namespace,
		"name", name)

	log.Debug("AnalyzeDeployment: gathering deployment context")
	ctx, err := a.getDeploymentContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeDeployment: failed to get deployment context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get deployment context: %w", err)
	}
	log.Info("AnalyzeDeployment: deployment context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes deployment and explain any issues:\n\nDeployment: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeDeployment: sending to Holmes",
		"questionLen", len(question))

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeDeployment: analysis failed",
			"error", err,
			"totalDuration", time.Since(startTime))
	} else {
		log.Info("AnalyzeDeployment: completed",
			"responseLen", len(resp.Response),
			"totalDuration", time.Since(startTime))
	}
	return resp, err
}

// AnalyzeStatefulSet gathers statefulset context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeStatefulSet(namespace, name string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeStatefulSet: starting",
		"namespace", namespace,
		"name", name)

	log.Debug("AnalyzeStatefulSet: gathering statefulset context")
	ctx, err := a.getStatefulSetContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeStatefulSet: failed to get statefulset context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get statefulset context: %w", err)
	}
	log.Info("AnalyzeStatefulSet: statefulset context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes statefulset and explain any issues:\n\nStatefulSet: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeStatefulSet: sending to Holmes",
		"questionLen", len(question))

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeStatefulSet: analysis failed",
			"error", err,
			"totalDuration", time.Since(startTime))
	} else {
		log.Info("AnalyzeStatefulSet: completed",
			"responseLen", len(resp.Response),
			"totalDuration", time.Since(startTime))
	}
	return resp, err
}

// AnalyzeDaemonSet gathers daemonset context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeDaemonSet(namespace, name string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeDaemonSet: starting",
		"namespace", namespace,
		"name", name)

	log.Debug("AnalyzeDaemonSet: gathering daemonset context")
	ctx, err := a.getDaemonSetContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeDaemonSet: failed to get daemonset context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get daemonset context: %w", err)
	}
	log.Info("AnalyzeDaemonSet: daemonset context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes daemonset and explain any issues:\n\nDaemonSet: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeDaemonSet: sending to Holmes",
		"questionLen", len(question))

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeDaemonSet: analysis failed",
			"error", err,
			"totalDuration", time.Since(startTime))
	} else {
		log.Info("AnalyzeDaemonSet: completed",
			"responseLen", len(resp.Response),
			"totalDuration", time.Since(startTime))
	}
	return resp, err
}

// AnalyzeService gathers service context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeService(namespace, name string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeService: starting",
		"namespace", namespace,
		"name", name)

	log.Debug("AnalyzeService: gathering service context")
	ctx, err := a.getServiceContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeService: failed to get service context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get service context: %w", err)
	}
	log.Info("AnalyzeService: service context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes service and explain any issues:\n\nService: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeService: sending to Holmes",
		"questionLen", len(question))

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeService: analysis failed",
			"error", err,
			"totalDuration", time.Since(startTime))
	} else {
		log.Info("AnalyzeService: completed",
			"responseLen", len(resp.Response),
			"totalDuration", time.Since(startTime))
	}
	return resp, err
}

// AnalyzeResource routes to the correct analyzer based on resource kind.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeResource(kind, namespace, name string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	log.Info("AnalyzeResource: routing",
		"kind", kind,
		"namespace", namespace,
		"name", name)

	switch strings.ToLower(kind) {
	case "pod", "pods":
		return a.AnalyzePod(namespace, name)
	case "deployment", "deployments":
		return a.AnalyzeDeployment(namespace, name)
	case "statefulset", "statefulsets":
		return a.AnalyzeStatefulSet(namespace, name)
	case "daemonset", "daemonsets":
		return a.AnalyzeDaemonSet(namespace, name)
	case "service", "services":
		return a.AnalyzeService(namespace, name)
	default:
		return nil, fmt.Errorf("unsupported resource kind: %s", kind)
	}
}

// AnalyzePodStream gathers pod context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzePodStream(namespace, name, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzePodStream: starting",
		"namespace", namespace,
		"name", name,
		"streamID", streamID)

	log.Debug("AnalyzePodStream: gathering pod context")
	ctx, err := a.getPodContext(namespace, name)
	if err != nil {
		log.Error("AnalyzePodStream: failed to get pod context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get pod context: %w", err)
	}
	log.Info("AnalyzePodStream: pod context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes pod and explain any issues:\n\nPod: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzePodStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeDeploymentStream gathers deployment context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeDeploymentStream(namespace, name, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeDeploymentStream: starting",
		"namespace", namespace,
		"name", name,
		"streamID", streamID)

	log.Debug("AnalyzeDeploymentStream: gathering deployment context")
	ctx, err := a.getDeploymentContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeDeploymentStream: failed to get deployment context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get deployment context: %w", err)
	}
	log.Info("AnalyzeDeploymentStream: deployment context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes deployment and explain any issues:\n\nDeployment: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeDeploymentStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeStatefulSetStream gathers statefulset context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeStatefulSetStream(namespace, name, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeStatefulSetStream: starting",
		"namespace", namespace,
		"name", name,
		"streamID", streamID)

	log.Debug("AnalyzeStatefulSetStream: gathering statefulset context")
	ctx, err := a.getStatefulSetContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeStatefulSetStream: failed to get statefulset context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get statefulset context: %w", err)
	}
	log.Info("AnalyzeStatefulSetStream: statefulset context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes statefulset and explain any issues:\n\nStatefulSet: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeStatefulSetStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeDaemonSetStream gathers daemonset context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeDaemonSetStream(namespace, name, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeDaemonSetStream: starting",
		"namespace", namespace,
		"name", name,
		"streamID", streamID)

	log.Debug("AnalyzeDaemonSetStream: gathering daemonset context")
	ctx, err := a.getDaemonSetContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeDaemonSetStream: failed to get daemonset context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get daemonset context: %w", err)
	}
	log.Info("AnalyzeDaemonSetStream: daemonset context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes daemonset and explain any issues:\n\nDaemonSet: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeDaemonSetStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeServiceStream gathers service context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeServiceStream(namespace, name, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AnalyzeServiceStream: starting",
		"namespace", namespace,
		"name", name,
		"streamID", streamID)

	log.Debug("AnalyzeServiceStream: gathering service context")
	ctx, err := a.getServiceContext(namespace, name)
	if err != nil {
		log.Error("AnalyzeServiceStream: failed to get service context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get service context: %w", err)
	}
	log.Info("AnalyzeServiceStream: service context gathered",
		"contextLen", len(ctx),
		"elapsed", time.Since(startTime))

	question := fmt.Sprintf(
		"Analyze this Kubernetes service and explain any issues:\n\nService: %s/%s\n\n%s",
		namespace, name, ctx,
	)

	log.Debug("AnalyzeServiceStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeResourceStream routes to the correct streaming analyzer based on resource kind.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeResourceStream(kind, namespace, name, streamID string) error {
	log := holmesgpt.GetLogger()
	log.Info("AnalyzeResourceStream: routing",
		"kind", kind,
		"namespace", namespace,
		"name", name,
		"streamID", streamID)

	switch strings.ToLower(kind) {
	case "pod", "pods":
		return a.AnalyzePodStream(namespace, name, streamID)
	case "deployment", "deployments":
		return a.AnalyzeDeploymentStream(namespace, name, streamID)
	case "statefulset", "statefulsets":
		return a.AnalyzeStatefulSetStream(namespace, name, streamID)
	case "daemonset", "daemonsets":
		return a.AnalyzeDaemonSetStream(namespace, name, streamID)
	case "service", "services":
		return a.AnalyzeServiceStream(namespace, name, streamID)
	default:
		return fmt.Errorf("unsupported resource kind: %s", kind)
	}
}

// AskHolmesStream streams a question to HolmesGPT and emits SSE events to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AskHolmesStream(question string, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	log.Info("AskHolmesStream: starting",
		"streamID", streamID,
		"questionLen", len(question))

	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		log.Error("AskHolmesStream: Holmes client not configured")
		return holmesgpt.ErrNotConfigured
	}
	if a.ctx == nil {
		log.Error("AskHolmesStream: app context not initialized")
		return fmt.Errorf("app context not initialized")
	}

	log.Debug("AskHolmesStream: creating stream context",
		"endpoint", client.GetEndpoint())

	ctx, cancel := context.WithCancel(context.Background())
	if streamID != "" {
		holmesStreamMu.Lock()
		holmesStreamCancels[streamID] = cancel
		holmesStreamMu.Unlock()
	}

	go func() {
		defer func() {
			if streamID != "" {
				holmesStreamMu.Lock()
				delete(holmesStreamCancels, streamID)
				holmesStreamMu.Unlock()
			}
			log.Info("AskHolmesStream: goroutine completed",
				"streamID", streamID,
				"totalDuration", time.Since(startTime))
		}()

		eventCount := 0
		streamOnce := func(activeClient *holmesgpt.HolmesClient) error {
			return activeClient.StreamAsk(ctx, question, func(event string, data []byte) error {
				eventCount++
				payload := holmesgpt.HolmesStreamEvent{
					StreamID: streamID,
					Event:    event,
					Data:     string(data),
				}
				wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
				return nil
			})
		}

		log.Debug("AskHolmesStream: calling streamOnce")
		err := streamOnce(client)
		if err != nil && (a.tryReconnectHolmesOnRefused(err, client.GetEndpoint()) || a.tryReconnectHolmesOnProxyNotFound(err, client.GetEndpoint())) {
			log.Warn("AskHolmesStream: reconnecting after connection issue",
				"error", err)
			holmesMu.RLock()
			client = holmesClient
			holmesMu.RUnlock()
			if client != nil {
				log.Info("AskHolmesStream: retrying stream after reconnect")
				err = streamOnce(client)
			}
		}
		if err != nil && isTimeoutError(err) && isKubeProxyEndpoint(client.GetEndpoint()) {
			log.Warn("AskHolmesStream: timeout on kube proxy, trying port-forward",
				"error", err)
			if pfErr := a.ensureHolmesPortForward(client.GetEndpoint()); pfErr != nil {
				log.Error("AskHolmesStream: port-forward failed",
					"error", pfErr)
				payload := holmesgpt.HolmesStreamEvent{
					StreamID: streamID,
					Event:    "error",
					Error:    fmt.Sprintf("Holmes proxy timed out; port-forward failed: %v", pfErr),
				}
				wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
				return
			}
			holmesMu.RLock()
			client = holmesClient
			holmesMu.RUnlock()
			if client != nil {
				log.Info("AskHolmesStream: retrying stream with port-forward")
				err = streamOnce(client)
			}
		}
		if err != nil {
			if errors.Is(err, context.Canceled) {
				log.Info("AskHolmesStream: stream cancelled",
					"eventCount", eventCount,
					"elapsed", time.Since(startTime))
				payload := holmesgpt.HolmesStreamEvent{
					StreamID: streamID,
					Event:    "stream_end",
				}
				wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
				return
			}
			log.Error("AskHolmesStream: stream failed",
				"error", err,
				"eventCount", eventCount,
				"elapsed", time.Since(startTime))
			payload := holmesgpt.HolmesStreamEvent{
				StreamID: streamID,
				Event:    "error",
				Error:    err.Error(),
			}
			wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
			return
		}

		log.Info("AskHolmesStream: stream completed successfully",
			"eventCount", eventCount,
			"elapsed", time.Since(startTime))
		payload := holmesgpt.HolmesStreamEvent{
			StreamID: streamID,
			Event:    "stream_end",
		}
		wailsRuntime.EventsEmit(a.ctx, "holmes:chat:stream", payload)
	}()

	return nil
}

// CancelHolmesStream stops a running HolmesGPT stream by stream ID.
// This is a Wails RPC method callable from the frontend.
func (a *App) CancelHolmesStream(streamID string) error {
	log := holmesgpt.GetLogger()
	log.Info("CancelHolmesStream: cancelling stream",
		"streamID", streamID)

	if streamID == "" {
		return nil
	}

	holmesStreamMu.Lock()
	cancel, ok := holmesStreamCancels[streamID]
	if ok {
		delete(holmesStreamCancels, streamID)
	}
	holmesStreamMu.Unlock()

	if ok {
		cancel()
		log.Info("CancelHolmesStream: stream cancelled successfully")
	} else {
		log.Debug("CancelHolmesStream: stream not found")
	}

	return nil

}

// GetHolmesConfig returns the current Holmes configuration with API key masked.
// This is a Wails RPC method callable from the frontend.
func (a *App) GetHolmesConfig() (holmesgpt.HolmesConfigData, error) {
	holmesMu.RLock()
	config := holmesConfig
	holmesMu.RUnlock()

	return config.MaskAPIKey(), nil
}

// SetHolmesConfig updates the Holmes configuration.
// This is a Wails RPC method callable from the frontend.
func (a *App) SetHolmesConfig(config holmesgpt.HolmesConfigData) error {
	// Validate the configuration
	if err := config.Validate(); err != nil {
		return err
	}

	// Update the configuration
	holmesConfig = config

	var transport http.RoundTripper

	if isInClusterEndpoint(holmesConfig.Endpoint) {
		namespace := holmesNamespaceFromEndpoint(holmesConfig.Endpoint)
		endpoint, newTransport, err := a.buildHolmesProxyEndpoint(namespace)
		if err != nil {
			return fmt.Errorf("failed to build Holmes proxy endpoint: %w", err)
		}
		holmesConfig.Endpoint = endpoint
		transport = newTransport
	} else if isKubeProxyEndpoint(holmesConfig.Endpoint) {
		namespace := holmesNamespaceFromProxyEndpoint(holmesConfig.Endpoint)
		endpoint, newTransport, err := a.buildHolmesProxyEndpoint(namespace)
		if err != nil {
			return fmt.Errorf("failed to refresh Holmes proxy endpoint: %w", err)
		}
		holmesConfig.Endpoint = endpoint
		transport = newTransport
	}

	// Save to persistent storage
	if err := a.saveConfig(); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	// Reinitialize the client
	if config.IsConfigured() {
		client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(holmesConfig, transport))
		if err != nil {
			return fmt.Errorf("failed to create Holmes client: %w", err)
		}

		holmesMu.Lock()
		holmesClient = client
		holmesMu.Unlock()
	} else {
		holmesMu.Lock()
		holmesClient = nil
		holmesMu.Unlock()
	}

	return nil
}

// ClearHolmesConfig resets the Holmes configuration to default (unconfigured) state.
// This is a Wails RPC method callable from the frontend.
func (a *App) ClearHolmesConfig() error {
	// Reset to default (unconfigured)
	holmesConfig = holmesgpt.DefaultConfig()

	// Clear the client
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	// Save to persistent storage
	if err := a.saveConfig(); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	return nil
}

// TestHolmesConnection tests the connection to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) TestHolmesConnection() (*holmesgpt.HolmesConnectionStatus, error) {
	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Error:     "Holmes is not configured",
		}, nil
	}

	err := client.TestConnection()
	if err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Endpoint:  client.GetEndpoint(),
			Error:     err.Error(),
		}, nil
	}

	return &holmesgpt.HolmesConnectionStatus{
		Connected: true,
		Endpoint:  client.GetEndpoint(),
	}, nil
}

// ReconnectHolmes attempts to re-establish the port-forward to Holmes and update the endpoint.
// This is useful when the app restarts or connection is lost.
// This is a Wails RPC method callable from the frontend.
func (a *App) ReconnectHolmes() (*holmesgpt.HolmesConnectionStatus, error) {
	// Rebuild proxy endpoint via API server
	namespace := holmesDefaultNamespace
	if isInClusterEndpoint(holmesConfig.Endpoint) {
		namespace = holmesNamespaceFromEndpoint(holmesConfig.Endpoint)
	} else if isKubeProxyEndpoint(holmesConfig.Endpoint) {
		namespace = holmesNamespaceFromProxyEndpoint(holmesConfig.Endpoint)
	}

	endpoint, transport, err := a.buildHolmesProxyEndpoint(namespace)
	if err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Error:     fmt.Sprintf("failed to establish API server proxy: %v", err),
		}, nil
	}

	// Update the configuration with the new endpoint
	holmesConfig.Endpoint = endpoint
	holmesConfig.Enabled = true

	// Create/update the client with the new endpoint
	client, err := holmesgpt.NewHolmesClient(buildHolmesClientConfig(holmesConfig, transport))
	if err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Endpoint:  endpoint,
			Error:     fmt.Sprintf("failed to create Holmes client: %v", err),
		}, nil
	}

	holmesMu.Lock()
	holmesClient = client
	holmesMu.Unlock()

	// Save the updated config
	_ = a.saveConfig()

	// Test the connection
	if err := client.TestConnection(); err != nil {
		return &holmesgpt.HolmesConnectionStatus{
			Connected: false,
			Endpoint:  endpoint,
			Error:     fmt.Sprintf("connection test failed: %v", err),
		}, nil
	}

	return &holmesgpt.HolmesConnectionStatus{
		Connected: true,
		Endpoint:  endpoint,
	}, nil
}

// GetHolmesLogPath returns the path to the Holmes log file.
// This is a Wails RPC method callable from the frontend.
func (a *App) GetHolmesLogPath() string {
	return holmesgpt.GetLogPath()
}
