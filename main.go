package main

import (
	"embed"

	apppkg "gowails/pkg/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// App is a thin wrapper to keep the binding path window['go']['main']['App'] stable
// while the implementation now lives in pkg/app.
type App struct {
	*apppkg.App
}

func main() {
	// Create an instance of the app structure (from pkg/app)
	app := &App{App: apppkg.NewApp()}

	// Start pod polling to emit events for the frontend
	app.StartPodPolling()
	// Start deployments polling to emit events for the frontend
	app.StartDeploymentPolling()
	// Start cronjobs polling to emit events for the frontend
	app.StartCronJobPolling()
	// Start daemonsets polling to emit events for the frontend
	app.StartDaemonSetPolling()
	// Start statefulsets polling to emit events for the frontend
	app.StartStatefulSetPolling()
	// Start replicasets polling to emit events for the frontend
	app.StartReplicaSetPolling()
	// Start monitor polling to emit warnings and errors for the frontend
	app.StartMonitorPolling()
	// Start helm releases polling to emit events for the frontend
	app.StartHelmReleasePolling()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "KubeDevBench",
		Width:  1720,
		Height: 880,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
