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
	if len(a.preferredNamespaces) > 0 {
		nsList := make([]string, len(a.preferredNamespaces))
		copy(nsList, a.preferredNamespaces)
		return nsList
	}
	if a.currentNamespace != "" {
		return []string{a.currentNamespace}
	}
	return []string{}
}
