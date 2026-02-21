package app

import (
	"context"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	apiextensionsfake "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset/fake"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── emitKindProgress clamping branches ──────────────────────────────────────

// TestEmitKindProgress_NegativePercent covers the "percent < 0 → clamp to 0"
// branch.
func TestEmitKindProgress_NegativePercent(t *testing.T) {
	app := &App{ctx: context.Background()}
	// Should not panic; percent is clamped to 0.
	app.emitKindProgress(-10, "test message", "stage", false)
}

// TestEmitKindProgress_OverHundred covers the "percent > 100 → clamp to 100"
// branch.
func TestEmitKindProgress_OverHundred(t *testing.T) {
	app := &App{ctx: context.Background()}
	// Should not panic; percent is clamped to 100.
	app.emitKindProgress(150, "test message", "stage", true)
}

// TestEmitKindProgress_Normal covers the pass-through path (0 ≤ percent ≤ 100).
func TestEmitKindProgress_Normal(t *testing.T) {
	app := &App{ctx: context.Background()}
	app.emitKindProgress(50, "halfway", "downloading", false)
}

// ─── processEventsV1Events branch coverage ───────────────────────────────────

// TestProcessEventsV1Events_DeprecatedTimestamp covers the path where
// EventTime is zero but DeprecatedLastTimestamp is non-zero.
func TestProcessEventsV1Events_DeprecatedTimestamp(t *testing.T) {
	past := time.Now().Add(-5 * time.Minute)
	e := &eventsv1.Event{
		ObjectMeta: metav1.ObjectMeta{Name: "ev-depr", Namespace: "default"},
		Type:       "Warning",
		// EventTime is zero (default)
		DeprecatedLastTimestamp: metav1.Time{Time: past},
		Regarding:               corev1.ObjectReference{Kind: "Pod", Name: "my-pod"},
		Reason:                  "OOMKilled",
		Note:                    "Out of memory",
	}
	clientset := fake.NewSimpleClientset(e)
	cutoff := time.Now().Add(-10 * time.Minute)

	issues := processEventsV1Events(clientset, context.Background(), "default", cutoff)
	if len(issues) != 1 {
		t.Errorf("expected 1 issue from DeprecatedLastTimestamp path, got %d", len(issues))
	}
}

// TestProcessEventsV1Events_OldEventSkipped covers the
// "lastTime.Before(cutoff) → continue" path.
func TestProcessEventsV1Events_OldEventSkipped(t *testing.T) {
	// Event that happened 2 hours ago.
	oldTime := time.Now().Add(-2 * time.Hour)
	e := &eventsv1.Event{
		ObjectMeta:              metav1.ObjectMeta{Name: "ev-old", Namespace: "default"},
		Type:                    "Warning",
		DeprecatedLastTimestamp: metav1.Time{Time: oldTime},
		Regarding:               corev1.ObjectReference{Kind: "Pod", Name: "old-pod"},
		Reason:                  "Evicted",
		Note:                    "Old eviction",
	}
	clientset := fake.NewSimpleClientset(e)
	// Cutoff is 30 minutes ago, so event at 2 hours ago is skipped.
	cutoff := time.Now().Add(-30 * time.Minute)

	issues := processEventsV1Events(clientset, context.Background(), "default", cutoff)
	if len(issues) != 0 {
		t.Errorf("expected 0 issues (old event should be skipped), got %d", len(issues))
	}
}

// TestProcessEventsV1Events_ListError covers the early return when List fails.
func TestProcessEventsV1Events_NonWarningSkipped(t *testing.T) {
	e := &eventsv1.Event{
		ObjectMeta:              metav1.ObjectMeta{Name: "ev-normal", Namespace: "default"},
		Type:                    "Normal", // not a warning
		DeprecatedLastTimestamp: metav1.Time{Time: time.Now()},
		Regarding:               corev1.ObjectReference{Kind: "Pod", Name: "normal-pod"},
		Reason:                  "Started",
		Note:                    "Container started",
	}
	clientset := fake.NewSimpleClientset(e)

	issues := processEventsV1Events(clientset, context.Background(), "default", time.Now().Add(-1*time.Hour))
	if len(issues) != 0 {
		t.Errorf("expected 0 issues (Normal events skipped), got %d", len(issues))
	}
}

// ─── GetCustomResourceDefinitionDetail "not found" path ──────────────────────

// TestGetCustomResourceDefinitionDetail_NotFound covers the error return from
// the CRD Get call when the requested CRD does not exist.
func TestGetCustomResourceDefinitionDetail_NotFound(t *testing.T) {
	crdClientset := apiextensionsfake.NewClientset() // empty – no CRDs
	app := &App{
		ctx:              context.Background(),
		testCRDClientset: crdClientset,
	}
	_, err := app.GetCustomResourceDefinitionDetail("nonexistent.example.com")
	if err == nil {
		t.Error("expected error for nonexistent CRD")
	}
}

// ─── handleDockerPullLine: KIND_DEBUG_LOG env path ───────────────────────────

// TestHandleDockerPullLine_DebugLogPath covers the KIND_DEBUG_LOG environment
// variable path.
func TestHandleDockerPullLine_DebugLogPath(t *testing.T) {
	dir := t.TempDir()
	logPath := dir + "/kind-debug.log"
	t.Setenv("KIND_DEBUG_LOG", logPath)

	app := &App{ctx: context.Background()}
	progress := &dockerPullProgress{
		layers: make(map[string]dockerLayerProgress),
	}
	app.handleDockerPullLine("someimage: Pull complete", progress)
	// No assertions needed – we just verify the code path doesn't panic.
}

// TestHandleDockerPullLine_DownloadingFallback covers the fallback branch that
// triggers when a line contains "downloading" and lastPercent is below 45.
func TestHandleDockerPullLine_DownloadingFallback(t *testing.T) {
	app := &App{ctx: context.Background()}
	progress := &dockerPullProgress{
		layers:      make(map[string]dockerLayerProgress),
		lastPercent: 0, // below 45
	}
	app.handleDockerPullLine("Downloading image layers…", progress)
	if progress.lastPercent != 45 {
		t.Errorf("expected lastPercent=45, got %d", progress.lastPercent)
	}
}
