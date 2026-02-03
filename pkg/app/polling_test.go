package app

import (
	"context"
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
