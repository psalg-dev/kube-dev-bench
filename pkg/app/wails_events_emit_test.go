package app

import (
	"context"
	"testing"
)

func TestEmitEvent_Disabled_NoPanic(t *testing.T) {
	disableWailsEvents = true
	defer func() { disableWailsEvents = false }()
	emitEvent(context.Background(), "unit:test", map[string]string{"key": "value"})
}

func TestEmitEvent_NilContext_NoPanic(t *testing.T) {
	disableWailsEvents = false
	emitEvent(nil, "unit:test", nil)
}
