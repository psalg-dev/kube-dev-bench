package app

import (
	"fmt"
	"strings"
	"time"

	"gowails/pkg/logger"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ErrAuthExpired is returned when the cluster probe returns a 401 Unauthorized,
// indicating that the auth token (OIDC, exec-provider, etc.) is absent or expired.
type ErrAuthExpired struct {
	Context string
	Err     error
}

func (e *ErrAuthExpired) Error() string {
	return fmt.Sprintf("authentication expired for context %s: %v", e.Context, e.Err)
}

func (e *ErrAuthExpired) Unwrap() error { return e.Err }

// ErrExecBinaryNotFound is returned when a kubeconfig exec credential provider
// references a binary that is not found in the PATH.
type ErrExecBinaryNotFound struct {
	Binary string
	Err    error
}

func (e *ErrExecBinaryNotFound) Error() string {
	return fmt.Sprintf("credential provider binary %q not found in PATH: %v", e.Binary, e.Err)
}

func (e *ErrExecBinaryNotFound) Unwrap() error { return e.Err }

// isRBACForbidden returns true for 403 Forbidden errors — the cluster is reachable
// but RBAC restricts the operation.
func isRBACForbidden(err error) bool {
	if err == nil {
		return false
	}
	if apierrors.IsForbidden(err) {
		return true
	}
	le := strings.ToLower(err.Error())
	return strings.Contains(le, "forbidden")
}

// isUnauthenticated returns true for 401 Unauthorized errors — the token is
// absent, expired, or invalid.
func isUnauthenticated(err error) bool {
	if err == nil {
		return false
	}
	if apierrors.IsUnauthorized(err) {
		return true
	}
	le := strings.ToLower(err.Error())
	return strings.Contains(le, "unauthorized") || strings.Contains(le, "unauthenticated")
}

// handleUnauthenticated debounces 401 events and emits SessionAuthExpired to the
// frontend at most once per debounce window.
func (a *App) handleUnauthenticated(contextName string) {
	a.authExpiredMu.Lock()
	defer a.authExpiredMu.Unlock()

	now := time.Now()
	if now.Sub(a.lastAuthExpiredEmit) < authExpiredDebounce {
		return
	}
	a.lastAuthExpiredEmit = now

	logger.Warn("session auth expired, emitting event", "context", contextName)
	emitEvent(a.ctx, EventSessionAuthExpired, map[string]interface{}{
		"context": contextName,
	})
}

const authExpiredDebounce = 30 * time.Second
