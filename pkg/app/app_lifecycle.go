package app

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
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

	logMu      sync.Mutex
	logCancels map[string]context.CancelFunc
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
	if err := os.MkdirAll(newDir, 0755); err != nil {
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
	}
}

func copyFile(src, dst string) error {
	sf, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sf.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
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
}

// GetCurrentConfig returns the currently loaded configuration
func (a *App) GetCurrentConfig() AppConfig {
	return AppConfig{
		CurrentContext:      a.currentKubeContext,
		CurrentNamespace:    a.currentNamespace,
		PreferredNamespaces: append([]string(nil), a.preferredNamespaces...),
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
