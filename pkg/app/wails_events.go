package app

import (
	"context"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// disableWailsEvents turns off Wails event emission (used in unit tests).
var disableWailsEvents bool

func emitEvent(ctx context.Context, name string, data interface{}) {
	if disableWailsEvents || ctx == nil {
		return
	}
	wailsRuntime.EventsEmit(ctx, name, data)
}

// getPollingNamespaces returns the namespaces to poll based on preferred and current namespace.
func (a *App) getPollingNamespaces() []string {
	nsList := a.preferredNamespaces
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	return nsList
}
