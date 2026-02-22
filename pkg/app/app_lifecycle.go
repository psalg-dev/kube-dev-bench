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
	isInsecureConnection bool      // tracks if we're using insecure TLS
	insecureWarnOnce     sync.Once // ensures we log TLS fallback warning only once

	// swarmVolumeHelpers caches per-volume helper container IDs for volume file browsing.
	// This allows reuse across Browse/Read calls (Phase 1) without creating a new container each time.
	swarmVolumeHelpersMu sync.Mutex
	swarmVolumeHelpers   map[string]string

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
	TestExecInPod func(namespace, pod, container string, command []string, timeout time.Duration) (string, error)
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

	pollingMu      sync.Mutex
	pollingStarted bool
	pollingStopCh  chan struct{}
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
		countsRefreshCh:      make(chan struct{}, 1),
		swarmVolumeHelpers:   make(map[string]string),
		useInformers:         false,
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
	if err := a.loadConfig(); err != nil {
		fmt.Printf("Error loading config: %v\n", err)
	}
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
		a.startInformerManager()
	} else {
		a.StartAllPolling()
	}

	// Initialize Holmes AI client if configured
	a.initHolmes()
	// Initialize MCP server if enabled
	a.initMCP()
}

// Shutdown is called by Wails when the app is closing.
// Best-effort cleanup only; errors are logged and ignored.
func (a *App) Shutdown(ctx context.Context) {
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

	// Stop MCP server if running.
	a.shutdownMCP()
}

// GetCurrentConfig returns the currently loaded configuration
func (a *App) GetCurrentConfig() AppConfig {
	return AppConfig{
		CurrentContext:      a.currentKubeContext,
		CurrentNamespace:    a.currentNamespace,
		PreferredNamespaces: append([]string(nil), a.preferredNamespaces...),
		UseInformers:        a.useInformers,
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
