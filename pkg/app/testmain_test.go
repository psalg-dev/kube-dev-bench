package app

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	disableWailsEvents = true
	os.Exit(m.Run())
}

// newAppNoCtx returns an App with no Kubernetes context configured (so
// getKubernetesInterface will return an error), but with currentNamespace set
// so that functions that guard on currentNamespace don't return early before
// reaching the K8s client call.
func newAppNoCtx() *App {
	a := NewApp()
	a.currentNamespace = "default"
	return a
}
