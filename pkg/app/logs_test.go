package app

import (
	"context"
	"sync"
	"testing"
)

func TestStopPodLogs_NoPreviousStream(t *testing.T) {
	// Note: We can't fully test StopPodLogs because it uses wails runtime.EventsEmit
	// which requires a valid wails context. We can test the map operations.
	app := &App{
		logCancels: make(map[string]context.CancelFunc),
	}

	// Test that the cancel map operations work (but not the EventsEmit)
	app.logMu.Lock()
	_, exists := app.logCancels["nonexistent-pod"]
	app.logMu.Unlock()

	if exists {
		t.Error("nonexistent-pod should not be in logCancels")
	}
}

func TestLogCancelsMap_ConcurrentAccess(t *testing.T) {
	app := &App{
		logCancels: make(map[string]context.CancelFunc),
	}

	// Create some cancel functions
	for i := 0; i < 10; i++ {
		_, cancel := context.WithCancel(context.Background())
		app.logMu.Lock()
		app.logCancels["pod-"+string(rune('a'+i))] = cancel
		app.logMu.Unlock()
	}

	// Access and remove concurrently
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			podName := "pod-" + string(rune('a'+idx))
			app.logMu.Lock()
			cancel, ok := app.logCancels[podName]
			if ok {
				delete(app.logCancels, podName)
			}
			app.logMu.Unlock()
			if ok && cancel != nil {
				cancel()
			}
		}(i)
	}
	wg.Wait()

	// Verify all entries were removed
	app.logMu.Lock()
	count := len(app.logCancels)
	app.logMu.Unlock()
	if count != 0 {
		t.Errorf("All entries should be removed, %d remaining", count)
	}
}

// TestLogCancelsMap_AddAndRemove tests adding and removing cancel functions
func TestLogCancelsMap_AddAndRemove(t *testing.T) {
	app := &App{
		logCancels: make(map[string]context.CancelFunc),
	}

	// Add a cancel function
	_, cancel := context.WithCancel(context.Background())
	app.logMu.Lock()
	app.logCancels["test-pod"] = cancel
	app.logMu.Unlock()

	// Verify it was added
	app.logMu.Lock()
	_, exists := app.logCancels["test-pod"]
	app.logMu.Unlock()
	if !exists {
		t.Error("test-pod should exist in logCancels")
	}

	// Remove it
	app.logMu.Lock()
	delete(app.logCancels, "test-pod")
	app.logMu.Unlock()

	// Verify removal
	app.logMu.Lock()
	_, exists = app.logCancels["test-pod"]
	app.logMu.Unlock()
	if exists {
		t.Error("test-pod should not exist after removal")
	}
}

// TestLogCancelsMap_MultiplePodsSerial tests managing multiple pods
func TestLogCancelsMap_MultiplePodsSerial(t *testing.T) {
	app := &App{
		logCancels: make(map[string]context.CancelFunc),
	}

	pods := []string{"pod-1", "pod-2", "pod-3"}
	cancels := make([]context.CancelFunc, len(pods))

	// Add all pods
	for i, podName := range pods {
		_, cancel := context.WithCancel(context.Background())
		cancels[i] = cancel
		app.logMu.Lock()
		app.logCancels[podName] = cancel
		app.logMu.Unlock()
	}

	// Verify count
	app.logMu.Lock()
	count := len(app.logCancels)
	app.logMu.Unlock()
	if count != len(pods) {
		t.Errorf("expected %d pods, got %d", len(pods), count)
	}

	// Remove one and verify
	app.logMu.Lock()
	delete(app.logCancels, "pod-2")
	count = len(app.logCancels)
	app.logMu.Unlock()
	if count != 2 {
		t.Errorf("expected 2 pods after removal, got %d", count)
	}

	// Clean up
	for _, cancel := range cancels {
		cancel()
	}
}

// TestLogCancelsMap_ReplaceExisting tests replacing an existing cancel function
func TestLogCancelsMap_ReplaceExisting(t *testing.T) {
	app := &App{
		logCancels: make(map[string]context.CancelFunc),
	}

	// Add initial cancel
	ctx1, cancel1 := context.WithCancel(context.Background())
	app.logMu.Lock()
	app.logCancels["test-pod"] = cancel1
	app.logMu.Unlock()

	// Replace with new cancel
	_, cancel2 := context.WithCancel(context.Background())
	app.logMu.Lock()
	app.logCancels["test-pod"] = cancel2
	app.logMu.Unlock()

	// Old context should still be cancellable
	cancel1()
	select {
	case <-ctx1.Done():
		// Expected
	default:
		t.Error("old context should be cancelled")
	}

	// Clean up
	cancel2()
}

// TestLogCancelsMap_EmptyMap tests operations on empty map
func TestLogCancelsMap_EmptyMap(t *testing.T) {
	app := &App{
		logCancels: make(map[string]context.CancelFunc),
	}

	// Lookup in empty map should return false
	app.logMu.Lock()
	cancel, exists := app.logCancels["nonexistent"]
	app.logMu.Unlock()

	if exists {
		t.Error("should not find entry in empty map")
	}
	if cancel != nil {
		t.Error("cancel should be nil for nonexistent entry")
	}
}
