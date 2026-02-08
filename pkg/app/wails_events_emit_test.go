package app

import (
	"context"
	"testing"
)

func TestEmitEvent_Disabled_NoPanic(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })
	emitEvent(context.Background(), "unit:test", map[string]string{"key": "value"})
}

func TestEmitEvent_NilContext_NoPanic(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = false
	t.Cleanup(func() { disableWailsEvents = previous })
	emitEvent(nil, "unit:test", nil)
}
