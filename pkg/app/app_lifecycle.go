package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// App struct
// Holds application-wide state and references
// (intentionally kept minimal; feature logic lives in other files)
type App struct {
	ctx                context.Context
	kubeConfig         string // kept for compatibility
	currentKubeContext string // selected kube context name
	currentNamespace   string // selected namespace
	configPath         string
	rememberContext    bool
	rememberNamespace  bool

	logMu      sync.Mutex
	logCancels map[string]context.CancelFunc
}

// NewApp creates a new App application struct
func NewApp() *App {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting user home directory: %v\n", err)
		return &App{}
	}

	// Ensure gowails directory exists
	configDir := filepath.Join(home, "gowails")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		fmt.Printf("Error creating config directory: %v\n", err)
		return &App{}
	}

	return &App{
		configPath: filepath.Join(configDir, "config.json"),
		logCancels: make(map[string]context.CancelFunc),
	}
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
		CurrentContext:   a.currentKubeContext,
		CurrentNamespace: a.currentNamespace,
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
