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
