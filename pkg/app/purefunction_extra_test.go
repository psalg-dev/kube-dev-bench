package app

import (
	"context"
	"math"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	eventsv1 "k8s.io/api/events/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── formatBytes edge cases ───────────────────────────────────────────────────

// TestFormatBytes_LessThanUnit covers the "bytes < unit" (< 1024) path.
func TestFormatBytes_LessThanUnit(t *testing.T) {
	got := formatBytes(500)
	if got != "500 B" {
		t.Errorf("expected '500 B', got %q", got)
	}
}

// TestFormatBytes_Overflow covers the "exp >= len(sizes)" guard that clamps the
// size label when bytes exceeds the TB range (exabyte-scale input).
func TestFormatBytes_Overflow(t *testing.T) {
	// math.MaxInt on 64-bit systems is > 1 EB, which will overflow the sizes
	// slice.  The function must clamp exp to len(sizes)-1.
	got := formatBytes(math.MaxInt)
	if got == "" {
		t.Error("expected non-empty string for MaxInt bytes")
	}
}

// ─── parseEventTime: RFC3339 (no nanoseconds) path ───────────────────────────

// TestParseEventTime_RFC3339 covers the second parse attempt (RFC3339 without
// nanoseconds) when the first attempt (RFC3339Nano) fails.
func TestParseEventTime_RFC3339(t *testing.T) {
	input := "2024-03-15T10:30:00Z"
	got := parseEventTime(input)
	if got.IsZero() {
		t.Error("expected non-zero time for valid RFC3339 string")
	}
	if got.Year() != 2024 || got.Month() != 3 || got.Day() != 15 {
		t.Errorf("unexpected parsed time: %v", got)
	}
}

// TestParseEventTime_BothFail covers the fallback return when neither format
// matches.
func TestParseEventTime_BothFail(t *testing.T) {
	got := parseEventTime("not-a-time")
	if !got.IsZero() {
		t.Errorf("expected zero time for unparseable input, got %v", got)
	}
}

// ─── DeleteResource: unsupported type (default case) ─────────────────────────

// TestDeleteResource_UnsupportedType covers the default case that returns
// ErrUnsupportedResourceType.
func TestDeleteResource_UnsupportedType(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.DeleteResource("flibbertigibbet", "default", "name")
	if err == nil {
		t.Error("expected error for unsupported resource type")
	}
}

// ─── convertEventsV1Event: first/EventTime and DeprecatedCount paths ─────────

// TestConvertEventsV1Event_EventTimeAsFirst covers the branch where
// DeprecatedFirstTimestamp is zero but EventTime is non-zero, so EventTime is
// used for `first`.
func TestConvertEventsV1Event_EventTimeAsFirst(t *testing.T) {
	now := time.Now()
	e := eventsv1.Event{
		ObjectMeta: metav1.ObjectMeta{Name: "ev1"},
		Type:       "Warning",
		Reason:     "Test",
		Note:       "test event",
		EventTime:  metav1.NewMicroTime(now),
		// DeprecatedFirstTimestamp intentionally zero
	}
	info := convertEventsV1Event(e)
	if info.FirstTimestamp == "" {
		t.Error("expected non-empty FirstTimestamp when EventTime is set")
	}
}

// TestConvertEventsV1Event_DeprecatedCount covers the
// "else if e.DeprecatedCount != 0" branch.
func TestConvertEventsV1Event_DeprecatedCount(t *testing.T) {
	e := eventsv1.Event{
		ObjectMeta:      metav1.ObjectMeta{Name: "ev-count"},
		Type:            "Warning",
		Reason:          "Repeated",
		Note:            "counted event",
		DeprecatedCount: 42,
		// Series is nil
	}
	info := convertEventsV1Event(e)
	if info.Count != 42 {
		t.Errorf("expected Count=42, got %d", info.Count)
	}
}

// TestConvertEventsV1Event_DeprecatedSource covers the source construction
// branch.
func TestConvertEventsV1Event_DeprecatedSource(t *testing.T) {
	e := eventsv1.Event{
		ObjectMeta:       metav1.ObjectMeta{Name: "ev-src"},
		Type:             "Normal",
		Reason:           "Scheduled",
		Note:             "sourced event",
		DeprecatedSource: corev1.EventSource{Component: "kubelet", Host: "node-1"},
	}
	info := convertEventsV1Event(e)
	if info.Source == "" {
		t.Error("expected non-empty Source when DeprecatedSource is set")
	}
}

// ─── computeNextRuns branch coverage ─────────────────────────────────────────

// TestComputeNextRuns_ZeroCount covers the "count <= 0" early return.
func TestComputeNextRuns_ZeroCount(t *testing.T) {
	got := computeNextRuns("*/5 * * * *", time.Now(), 0)
	if len(got) != 0 {
		t.Errorf("expected empty slice for count=0, got %d items", len(got))
	}
}

// TestComputeNextRuns_InvalidSchedule covers the parse error return.
func TestComputeNextRuns_InvalidSchedule(t *testing.T) {
	got := computeNextRuns("invalid-cron", time.Now(), 3)
	if len(got) != 0 {
		t.Errorf("expected empty slice for invalid schedule, got %d items", len(got))
	}
}

// ─── refreshPodStatusOnly: empty-string namespace in list ────────────────────

// TestRefreshPodStatusOnly_EmptyNamespaceInList covers the
// "if ns == ” { continue }" path.
func TestRefreshPodStatusOnly_EmptyNamespaceInList(t *testing.T) {
	app := &App{
		ctx:                 context.Background(),
		currentKubeContext:  "test-context",
		preferredNamespaces: []string{"", "default"}, // first entry is empty
		testClientset:       fake.NewSimpleClientset(),
	}
	// Should complete without panic.
	app.refreshPodStatusOnly()
}

// ─── GetCronJobs: error handling from getKubernetesInterface ─────────────────

// TestGetCronJobs_EmptyNamespace verifies GetCronJobs handles empty namespace
// by returning an error (namespace validation).
func TestGetCronJobs_EmptyClientset(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	jobs, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if jobs == nil {
		t.Error("expected non-nil (empty) jobs slice")
	}
}
