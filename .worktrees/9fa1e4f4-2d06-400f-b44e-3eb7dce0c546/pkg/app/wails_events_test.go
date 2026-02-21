package app

import (
	"reflect"
	"testing"
)

func init() {
	disableWailsEvents = true
}

func TestGetPollingNamespaces_PreferredCopy(t *testing.T) {
	app := &App{
		preferredNamespaces: []string{"ns-a", "ns-b"},
		currentNamespace:    "default",
	}

	got := app.getPollingNamespaces()
	if !reflect.DeepEqual(got, []string{"ns-a", "ns-b"}) {
		t.Fatalf("unexpected namespaces: %v", got)
	}

	got[0] = "changed"
	if app.preferredNamespaces[0] != "ns-a" {
		t.Errorf("expected preferred namespaces to remain unchanged, got %v", app.preferredNamespaces)
	}
}

func TestGetPollingNamespaces_CurrentNamespaceFallback(t *testing.T) {
	app := &App{currentNamespace: "default"}

	got := app.getPollingNamespaces()
	if !reflect.DeepEqual(got, []string{"default"}) {
		t.Fatalf("unexpected namespaces: %v", got)
	}
}

func TestGetPollingNamespaces_Empty(t *testing.T) {
	app := &App{}

	got := app.getPollingNamespaces()
	if len(got) != 0 {
		t.Fatalf("expected empty namespaces, got %v", got)
	}
}
