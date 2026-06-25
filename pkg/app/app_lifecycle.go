package app

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"gowails/pkg/app/holmesgpt"
	"gowails/pkg/logger"

	"k8s.io/client-go/kubernetes"
)

// App struct
// Holds application-wide state and references
// (intentionally kept minimal; feature logic lives in other files)
type App struct {
	ctx                  context.Context
	kubeConfig           string   // kept for compatibility
	currentKubeContext   string   // selected kube context name
	currentNamespace     string   // selected namespace
	preferredNamespaces  []string // multi-namespace selection (preferred)
	configPath           string
	rememberContext      bool
	rememberNamespace    bool
	isInsecureConnection bool   // tracks if we're using insecure TLS
	insecureWarnCtx      string // context name for which the insecure warning was last logged (SUG-9)
	customCAPath         string // optional path to a custom CA cert for Kubernetes connections
	// allowInsecure is per-context: maps context name → user opted into insecure TLS (CRIT-4)
	allowInsecure map[string]bool

	// Auth expiry debounce state
	authExpiredMu       sync.Mutex
	lastAuthExpiredEmit time.Time

	// Session probe (Gap 7)
	sessionProbeMu       sync.Mutex
	sessionProbeCancel   context.CancelFunc
	sessionProbeInterval time.Duration // 0 = disabled

	// Multi-kubeconfig paths (Gap 4)
	kubeconfigPaths []string

	// swarmVolumeHelpers caches per-volume helper container IDs for volume file browsing.
	// This allows reuse across Browse/Read calls (Phase 1) without creating a new container each time.
	swarmVolumeHelpersMu sync.Mutex
	swarmVolumeHelpers   map[string]string

	// pvcHelperPods tracks K8s PVC browse helper pods created by the app (CRIT-3).
	// Key: "namespace/podName",  cleaned up on Shutdown.
	pvcHelperPodsMu sync.Mutex
	pvcHelperPods   map[string]string

	// Proxy configuration
	proxyURL      string // HTTP/HTTPS proxy URL (e.g., http://proxy.example.com:8080)
	proxyAuthType string // "none", "basic", "system"
	proxyUsername string // username for basic auth
	proxyPassword string // password for basic auth

	logMu      sync.Mutex
	logCancels map[string]context.CancelFunc

	kindMu       sync.Mutex
	kindCancel   context.CancelFunc
	kindCancelID uint64
	kindCmd      *exec.Cmd
	kindPullCmd  *exec.Cmd

	// Aggregated resource counts (for sidebar counters)
	resourceCountsMu   sync.RWMutex
	lastResourceCounts ResourceCounts
	countsRefreshCh    chan struct{}

	// testClientset is used for testing only (dependency injection)
	testClientset interface{}
	// Exported alias for tests from other packages
	TestClientset kubernetes.Interface

	// testCRDClientset is used for testing CRD operations only (dependency injection)
	testCRDClientset interface{}

	// testPodLogsFetcher is used for testing only (dependency injection)
	testPodLogsFetcher func(namespace, podName, containerName string, lines int) (string, error)

	// Exported test exec stubs for other packages to set
	TestExecInPod        func(namespace, pod, container string, command []string, timeout time.Duration) (string, error)
	TestExecInPodLimited func(namespace, pod, container string, command []string, timeout time.Duration, maxBytes int64) (string, error)

	// testExecInPod allows tests to override execInPod behavior without needing a real cluster
	testExecInPod func(namespace, pod, container string, command []string, timeout time.Duration) (string, error)

	// testExecInPodLimited allows tests to override execInPodLimited behavior
	testExecInPodLimited func(namespace, pod, container string, command []string, timeout time.Duration, maxBytes int64) (string, error)

	// disableStartupDocker is used for unit tests only, to prevent Startup from
	// invoking Docker auto-connect and emitting Wails events with a non-Wails ctx.
	disableStartupDocker bool

	// graphCache stores short-lived relationship graph payloads to reduce repeated
	// expensive graph construction for quick refresh/re-open actions.
	graphCache sync.Map

	useInformers    bool
	informerMu      sync.Mutex
	informerManager *InformerManager

	// kubeContextMu protects reads/writes of currentKubeContext across
	// goroutines (pollers, informers, session probe, etc.).
	// Use getKubeContext() / setKubeContext() for thread-safe access.
	kubeContextMu sync.RWMutex

	// Cached kubernetes clientset to avoid creating a new one per API call.
	cachedClientMu  sync.Mutex
	cachedClientset *kubernetes.Clientset
	cachedClientCtx string // kube context the cached client was built for

	pollingMu      sync.Mutex
	pollingStarted bool
	pollingStopCh  chan struct{}

	// holmesConfig holds the Holmes configuration, protected by holmesConfigMu.
	holmesConfigMu sync.RWMutex
	holmesConfig   holmesgpt.HolmesConfigData
}

// getKubeContext returns the current kube context name in a thread-safe manner.
func (a *App) getKubeContext() string {
	a.kubeContextMu.RLock()
	defer a.kubeContextMu.RUnlock()
	return a.currentKubeContext
}

// setKubeContext stores the kube context name in a thread-safe manner.
func (a *App) setKubeContext(name string) {
	a.kubeContextMu.Lock()
	defer a.kubeContextMu.Unlock()
	a.currentKubeContext = name
}

// getHolmesConfig returns a snapshot of the Holmes configuration in a thread-safe manner.
func (a *App) getHolmesConfig() holmesgpt.HolmesConfigData {
	a.holmesConfigMu.RLock()
	defer a.holmesConfigMu.RUnlock()
	return a.holmesConfig
}

// setHolmesConfig stores the Holmes configuration in a thread-safe manner.
func (a *App) setHolmesConfig(cfg holmesgpt.HolmesConfigData) {
	a.holmesConfigMu.Lock()
	defer a.holmesConfigMu.Unlock()
	a.holmesConfig = cfg
}

// NewApp creates a new App application struct
func NewApp() *App {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting user home directory: %v\n", err)
		return &App{
			isInsecureConnection: false,
			logCancels:           make(map[string]context.CancelFunc),
		}
	}

	// Ensure KubeDevBench directory exists
	newDir := filepath.Join(home, "KubeDevBench")
	if err := os.MkdirAll(newDir, 0o750); err != nil {
		fmt.Printf("Error creating config directory: %v\n", err)
		return &App{
			isInsecureConnection: false,
			logCancels:           make(map[string]context.CancelFunc),
		}
	}
	newCfg := filepath.Join(newDir, "config.json")

	// Migrate from old directory if needed
	oldCfg := filepath.Join(home, "gowails", "config.json")
	if _, err := os.Stat(newCfg); os.IsNotExist(err) {
		if _, errOld := os.Stat(oldCfg); errOld == nil {
			if err := copyFile(oldCfg, newCfg); err != nil {
				fmt.Printf("Warning: failed to migrate old config: %v\n", err)
				// Fallback: use old config path to preserve settings
				return &App{
					configPath:           oldCfg,
					logCancels:           make(map[string]context.CancelFunc),
					isInsecureConnection: false, // Initialize to secure by default
				}
			}
		}
	}

	return &App{
		configPath:           newCfg,
		logCancels:           make(map[string]context.CancelFunc),
		isInsecureConnection: false, // Initialize to secure by default
		allowInsecure:        make(map[string]bool),
		countsRefreshCh:      make(chan struct{}, 1),
		swarmVolumeHelpers:   make(map[string]string),
		pvcHelperPods:        make(map[string]string),
		useInformers:         true,
		holmesConfig:         holmesgpt.DefaultConfig(),
	}
}

func copyFile(src, dst string) error {
	// #nosec G304 -- migration path is controlled by app config locations.
	sf, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sf.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o750); err != nil {
		return err
	}
	// #nosec G304 -- destination path is within app config directory.
	df, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() { _ = df.Close() }()
	if _, err := io.Copy(df, sf); err != nil {
		return err
	}
	return df.Sync()
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Gap 5: augment PATH on Windows to include common credential-provider locations.
	supplementWindowsPath()

	// Initialize file logger in a user-writable app directory.
	// Errors are always written to stderr by the logger package itself,
	// but we also log them here so they appear on the console during dev.
	if err := logger.Init(a.logDirectory()); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "Warning: could not initialize file logger: %v\n", err)
	}
	logger.Info("KubeDevBench starting up")

	if err := a.loadConfig(); err != nil {
		logger.Error("failed to load config", "error", err)
	}

	logger.Info("config loaded",
		"context", a.currentKubeContext,
		"namespace", a.currentNamespace,
		"kubeconfig", a.kubeConfig,
		"useInformers", a.useInformers,
	)

	// Start background aggregator goroutine
	if a.countsRefreshCh == nil { // safety
		a.countsRefreshCh = make(chan struct{}, 1)
	}
	go a.runResourceCountsAggregator()

	// Initialize Docker/Swarm connection in background
	if !a.disableStartupDocker {
		a.startupDocker(ctx)
	}

	if a.useInformers {
		logger.Info("starting informer manager (background)")
		go a.startInformerManager()
	} else {
		logger.Info("starting resource polling")
		a.StartAllPolling()
	}

	// Initialize Holmes AI client if configured
	a.initHolmes()
	// Initialize MCP server if enabled
	a.initMCP()
	// SUG-1: Initialize audit log
	a.initAudit()

	// Gap 7: start session probe if configured
	a.startSessionProbe()

	// SUG-3: start shell session idle reaper
	a.startShellSessionReaper(ctx)

	// SUG-5: start graph cache periodic sweeper
	a.startGraphCacheSweeper(ctx)

	logger.Info("startup complete")
}

func (a *App) logDirectory() string {
	base := filepath.Dir(a.configPath)
	if base == "" || base == "." {
		home, err := os.UserHomeDir()
		if err == nil {
			base = filepath.Join(home, "KubeDevBench")
		} else {
			base = "."
		}
	}
	return filepath.Join(base, "logs")
}

// Shutdown is called by Wails when the app is closing.
// Best-effort cleanup only; errors are logged and ignored.
func (a *App) Shutdown(ctx context.Context) {
	logger.Info("KubeDevBench shutting down")
	a.stopSessionProbe()
	a.stopInformerManager()
	a.StopAllPolling()

	// Cancel any active log streams.
	a.logMu.Lock()
	for k, cancel := range a.logCancels {
		if cancel != nil {
			cancel()
		}
		delete(a.logCancels, k)
	}
	a.logMu.Unlock()

	// Remove any helper containers created for Swarm volume browsing.
	_ = a.cleanupSwarmVolumeHelpers(ctx)

	// Clean up any PVC browse helper pods created in Kubernetes clusters (CRIT-3).
	a.cleanupPVCHelperPods()

	// Stop MCP server if running.
	a.shutdownMCP()

	// SUG-1: Close audit log.
	closeAudit()

	logger.Info("shutdown complete")
	logger.Close()
}

// GetCurrentConfig returns the currently loaded configuration
func (a *App) GetCurrentConfig() AppConfig {
	return AppConfig{
		CurrentContext:      a.getKubeContext(),
		CurrentNamespace:    a.currentNamespace,
		PreferredNamespaces: append([]string(nil), a.preferredNamespaces...),
		UseInformers:        a.useInformers,
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
