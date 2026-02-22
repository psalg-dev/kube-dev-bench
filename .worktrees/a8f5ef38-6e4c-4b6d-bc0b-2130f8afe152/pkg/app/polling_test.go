package app

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestStartResourcePolling(t *testing.T) {
	// This test verifies that the generic polling function works correctly
	// by simulating a simple polling scenario.

	// Create a mock App with necessary context
	app := &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{"default"},
	}

	// Track calls to the fetch function
	var mu sync.Mutex
	fetchCalls := 0
	fetchedNamespaces := []string{}

	// Create a simple fetch function for testing
	fetchFn := func(namespace string) ([]string, error) {
		mu.Lock()
		defer mu.Unlock()
		fetchCalls++
		fetchedNamespaces = append(fetchedNamespaces, namespace)
		return []string{"item1", "item2"}, nil
	}

	config := ResourcePollingConfig[string]{
		EventName: "test:update",
		FetchFn:   fetchFn,
		Interval:  50 * time.Millisecond, // Fast interval for testing
	}

	// Start polling
	startResourcePolling(app, config)

	// Wait for a few poll cycles
	time.Sleep(120 * time.Millisecond)

	// Verify the fetch function was called
	mu.Lock()
	calls := fetchCalls
	namespaces := fetchedNamespaces
	mu.Unlock()

	if calls == 0 {
		t.Error("Expected fetch function to be called at least once")
	}

	if len(namespaces) == 0 {
		t.Error("Expected namespaces to be fetched")
	}

	for _, ns := range namespaces {
		if ns != "default" {
			t.Errorf("Expected namespace 'default', got %q", ns)
		}
	}
}

func TestStartResourcePollingWithMultipleNamespaces(t *testing.T) {
	app := &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{"ns1", "ns2", "ns3"},
	}

	var mu sync.Mutex
	fetchedNamespaces := make(map[string]int)

	fetchFn := func(namespace string) ([]int, error) {
		mu.Lock()
		defer mu.Unlock()
		fetchedNamespaces[namespace]++
		return []int{1, 2, 3}, nil
	}

	config := ResourcePollingConfig[int]{
		EventName: "test:update",
		FetchFn:   fetchFn,
		Interval:  50 * time.Millisecond,
	}

	startResourcePolling(app, config)

	// Wait for a poll cycle
	time.Sleep(80 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	// Each namespace should have been fetched at least once
	for _, ns := range []string{"ns1", "ns2", "ns3"} {
		if fetchedNamespaces[ns] == 0 {
			t.Errorf("Expected namespace %q to be fetched", ns)
		}
	}
}

func TestStartResourcePollingSkipsWhenNoNamespaces(t *testing.T) {
	app := &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{}, // Empty namespaces
	}

	var mu sync.Mutex
	fetchCalls := 0

	fetchFn := func(namespace string) ([]string, error) {
		mu.Lock()
		defer mu.Unlock()
		fetchCalls++
		return []string{}, nil
	}

	config := ResourcePollingConfig[string]{
		EventName: "test:update",
		FetchFn:   fetchFn,
		Interval:  20 * time.Millisecond,
	}

	startResourcePolling(app, config)

	// Wait for a few would-be poll cycles
	time.Sleep(60 * time.Millisecond)

	mu.Lock()
	calls := fetchCalls
	mu.Unlock()

	if calls != 0 {
		t.Errorf("Expected fetch function not to be called when namespaces are empty, got %d calls", calls)
	}
}

func TestStartResourcePollingDefaultInterval(t *testing.T) {
	// Verify that if Interval is 0, it defaults to 1 second
	config := ResourcePollingConfig[string]{
		EventName: "test:update",
		FetchFn: func(namespace string) ([]string, error) {
			return nil, nil
		},
		Interval: 0, // Should default to 1 second
	}

	// We can't easily test the actual default without waiting,
	// but we can verify the config is accepted without panic
	app := &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{},
	}

	// This should not panic
	startResourcePolling(app, config)
}

func TestStartResourcePollingContinuesOnFetchError(t *testing.T) {
	app := &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{"default"},
	}

	var mu sync.Mutex
	fetchCalls := 0

	fetchFn := func(namespace string) ([]string, error) {
		mu.Lock()
		defer mu.Unlock()
		fetchCalls++
		if fetchCalls <= 2 {
			return nil, errors.New("transient error")
		}
		return []string{"recovered"}, nil
	}

	config := ResourcePollingConfig[string]{
		EventName: "test:update",
		FetchFn:   fetchFn,
		Interval:  30 * time.Millisecond,
	}

	startResourcePolling(app, config)

	deadline := time.Now().Add(300 * time.Millisecond)
	for {
		mu.Lock()
		calls := fetchCalls
		mu.Unlock()
		if calls >= 3 || time.Now().After(deadline) {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	mu.Lock()
	calls := fetchCalls
	mu.Unlock()

	if calls < 3 {
		t.Errorf("Expected polling to continue after errors, got only %d calls", calls)
	}
}

func TestStartResourcePollingSkipsWhenCtxNil(t *testing.T) {
	app := &App{
		ctx:                 nil, // No context yet
		preferredNamespaces: []string{"default"},
	}

	var mu sync.Mutex
	fetchCalls := 0

	fetchFn := func(namespace string) ([]string, error) {
		mu.Lock()
		defer mu.Unlock()
		fetchCalls++
		return []string{}, nil
	}

	config := ResourcePollingConfig[string]{
		EventName: "test:update",
		FetchFn:   fetchFn,
		Interval:  20 * time.Millisecond,
	}

	startResourcePolling(app, config)

	// Wait for a few would-be poll cycles
	time.Sleep(60 * time.Millisecond)

	mu.Lock()
	calls := fetchCalls
	mu.Unlock()

	if calls != 0 {
		t.Errorf("Expected fetch function not to be called when ctx is nil, got %d calls", calls)
	}
}

func TestStartResourcePollingFallsBackToCurrentNamespace(t *testing.T) {
	app := &App{
		ctx:                 context.Background(),
		preferredNamespaces: []string{},    // Empty preferred
		currentNamespace:    "fallback-ns", // Should use this
	}

	var mu sync.Mutex
	fetchedNamespaces := []string{}

	fetchFn := func(namespace string) ([]string, error) {
		mu.Lock()
		defer mu.Unlock()
		fetchedNamespaces = append(fetchedNamespaces, namespace)
		return []string{"item"}, nil
	}

	config := ResourcePollingConfig[string]{
		EventName: "test:update",
		FetchFn:   fetchFn,
		Interval:  30 * time.Millisecond,
	}

	startResourcePolling(app, config)

	time.Sleep(60 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	if len(fetchedNamespaces) == 0 {
		t.Error("Expected fetch to be called with fallback namespace")
	}
	for _, ns := range fetchedNamespaces {
		if ns != "fallback-ns" {
			t.Errorf("Expected namespace 'fallback-ns', got %q", ns)
		}
	}
}

func TestStartAllPollingDoesNotPanic(t *testing.T) {
	// Verify that StartAllPolling can be called without panicking.
	// We disable Wails events for the entire remaining test process to
	// prevent leaked goroutines from hitting wailsRuntime.EventsEmit
	// (which calls log.Fatalf with a non-Wails context).
	disableWailsEvents = true
	// NOTE: we intentionally do NOT reset disableWailsEvents here.
	// The goroutines spawned by StartAllPolling cannot be stopped
	// (no cancellation mechanism), so they will leak. Keeping
	// disableWailsEvents = true ensures they never call the Wails
	// runtime. This is safe because no other test in the package
	// requires Wails event emission.

	app := &App{
		ctx:                 nil, // pollers skip when ctx is nil
		preferredNamespaces: []string{},
		countsRefreshCh:     make(chan struct{}, 1),
	}

	// Should not panic
	app.StartAllPolling()

	// Give goroutines a moment to start
	time.Sleep(50 * time.Millisecond)
}
