package app

import (
	"context"
	"reflect"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
)

func TestNormalizeNamespaces(t *testing.T) {
	got := normalizeNamespaces([]string{"default", "", "default", "kube-system"})
	if len(got) != 2 {
		t.Fatalf("expected 2 namespaces, got %d (%v)", len(got), got)
	}
	if got[0] != "default" || got[1] != "kube-system" {
		t.Fatalf("unexpected namespace normalization result: %v", got)
	}
}

func TestInformerManagerStartAndNamespaceLookup(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{
		ctx:                context.Background(),
		testClientset:      clientset,
		countsRefreshCh:    make(chan struct{}, 1),
		currentKubeContext: "test",
	}

	manager := NewInformerManager(clientset, []string{"default"}, app)
	if err := manager.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	t.Cleanup(manager.Stop)

	factory, ok := manager.namespaceFactory("default")
	if !ok || factory == nil {
		t.Fatalf("expected namespace factory for default")
	}

	if _, ok := manager.namespaceFactory("kube-system"); ok {
		t.Fatalf("did not expect namespace factory for kube-system")
	}

	app.informerManager = manager
	if _, ok := app.getInformerNamespaceFactory("default"); !ok {
		t.Fatalf("expected app namespace factory lookup to succeed")
	}

	manager.Stop()
	if _, ok := app.getInformerNamespaceFactory("default"); ok {
		t.Fatalf("expected app namespace factory lookup to fail after stop")
	}
}

func TestGetRunningPodsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod-a", Namespace: "default"},
		Status:     corev1.PodStatus{Phase: corev1.PodRunning},
	})

	app := &App{
		ctx:                context.Background(),
		testClientset:      clientset,
		countsRefreshCh:    make(chan struct{}, 1),
		currentKubeContext: "test",
	}
	manager := NewInformerManager(clientset, []string{"default"}, app)
	if err := manager.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	t.Cleanup(manager.Stop)
	app.informerManager = manager

	pods, err := app.GetRunningPods("default")
	if err != nil {
		t.Fatalf("GetRunningPods() error = %v", err)
	}
	if len(pods) != 1 {
		t.Fatalf("expected 1 pod, got %d", len(pods))
	}
	if pods[0].Name != "pod-a" {
		t.Fatalf("unexpected pod name: %q", pods[0].Name)
	}
}

func TestSelectedNamespacesReturnsCopy(t *testing.T) {
	im := &InformerManager{namespaces: []string{"default", "kube-system"}}

	got := im.selectedNamespaces()
	if !reflect.DeepEqual(got, []string{"default", "kube-system"}) {
		t.Fatalf("selectedNamespaces() = %v", got)
	}

	got[0] = "mutated"
	if im.namespaces[0] != "default" {
		t.Fatalf("selectedNamespaces() returned aliased slice: %+v", im.namespaces)
	}
}

func TestInformerManagerStopClearsTimersAndState(t *testing.T) {
	timer := time.NewTimer(time.Hour)
	im := &InformerManager{
		started: true,
		stopCh:  make(chan struct{}),
		timers: map[string]*time.Timer{
			"pods:update": timer,
		},
		nsFactories: map[string]informers.SharedInformerFactory{},
	}

	im.Stop()

	if im.started {
		t.Fatalf("expected started=false after Stop()")
	}
	if im.stopCh != nil {
		t.Fatalf("expected stopCh to be nil after Stop()")
	}
	if len(im.timers) != 0 {
		t.Fatalf("expected timers cleared after Stop(), got %d", len(im.timers))
	}
	if im.nsFactories != nil {
		t.Fatalf("expected nsFactories nil after Stop()")
	}
}

func TestEmitAcrossNamespacesSkipsErrors(t *testing.T) {
	im := &InformerManager{
		app:        &App{ctx: context.Background()},
		namespaces: []string{"default", "broken", "ops"},
	}

	called := make([]string, 0, 3)
	err := emitAcrossNamespaces(im, EventPodsUpdate, func(namespace string) ([]string, error) {
		called = append(called, namespace)
		if namespace == "broken" {
			return nil, context.DeadlineExceeded
		}
		return []string{namespace + "-ok"}, nil
	})
	if err != nil {
		t.Fatalf("emitAcrossNamespaces() error = %v", err)
	}
	if !reflect.DeepEqual(called, []string{"default", "broken", "ops"}) {
		t.Fatalf("unexpected fetch call order: %v", called)
	}
}
