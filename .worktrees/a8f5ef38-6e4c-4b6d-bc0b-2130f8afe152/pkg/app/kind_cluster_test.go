package app

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestKindCluster_IsValidKindName(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{name: "empty", input: "", want: false},
		{name: "letters numbers dash underscore", input: "kdb-1_test", want: true},
		{name: "invalid space", input: "bad name", want: false},
		{name: "invalid symbol", input: "bad$name", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isValidKindName(tt.input); got != tt.want {
				t.Fatalf("isValidKindName(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestKindCluster_TrimCommandOutput(t *testing.T) {
	if got := trimCommandOutput([]byte("   \n\t ")); got != "" {
		t.Fatalf("expected empty trimmed output, got %q", got)
	}

	if got := trimCommandOutput([]byte("  hello  \n")); got != "hello" {
		t.Fatalf("expected \"hello\", got %q", got)
	}

	long := strings.Repeat("x", 500)
	got := trimCommandOutput([]byte(long))
	if !strings.HasSuffix(got, "...") || len(got) != 403 {
		t.Fatalf("expected truncated output with ellipsis, got len=%d suffix=%v", len(got), strings.HasSuffix(got, "..."))
	}
}

func TestKindCluster_OutputCollector(t *testing.T) {
	c := &kindOutputCollector{}
	c.Write([]byte("abc"))
	b1 := c.Bytes()
	b2 := c.Bytes()

	if string(b1) != "abc" || string(b2) != "abc" {
		t.Fatalf("unexpected collected bytes: %q / %q", string(b1), string(b2))
	}
	b1[0] = 'z'
	if string(c.Bytes()) != "abc" {
		t.Fatal("expected Bytes() to return a copy")
	}
}

func TestKindCluster_SplitKindOutput(t *testing.T) {
	advance, token, err := splitKindOutput([]byte("line1\nline2"), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if advance != 6 || string(token) != "line1" {
		t.Fatalf("unexpected split for newline: advance=%d token=%q", advance, string(token))
	}

	advance, token, err = splitKindOutput([]byte("line1\rline2"), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if advance != 6 || string(token) != "line1" {
		t.Fatalf("unexpected split for carriage return: advance=%d token=%q", advance, string(token))
	}

	advance, token, err = splitKindOutput([]byte("tail"), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if advance != 4 || string(token) != "tail" {
		t.Fatalf("unexpected EOF split: advance=%d token=%q", advance, string(token))
	}
}

func TestKindCluster_SizeAndPercentHelpers(t *testing.T) {
	if got := clampPercent(-1); got != 0 {
		t.Fatalf("expected clamp low=0, got %d", got)
	}
	if got := clampPercent(150); got != 100 {
		t.Fatalf("expected clamp high=100, got %d", got)
	}

	if got := parseSize("1.5", "MB"); got != int64(1.5*1024*1024) {
		t.Fatalf("unexpected MB parse result: %d", got)
	}
	if got := parseSize("2", "GiB"); got != 2*1024*1024*1024 {
		t.Fatalf("unexpected GiB parse result: %d", got)
	}
	if got := parseSize("abc", "MB"); got != 0 {
		t.Fatalf("expected parse failure to return 0, got %d", got)
	}

	if got := formatKindBytes(999); got != "999B" {
		t.Fatalf("unexpected bytes format: %q", got)
	}
	if got := formatKindBytes(1024); got != "1.0KB" {
		t.Fatalf("unexpected KB format: %q", got)
	}

	if got := formatDockerPhase("extracting"); got != "Extracting" {
		t.Fatalf("unexpected phase text: %q", got)
	}
	if got := formatDockerPhase("other"); got != "Pulling" {
		t.Fatalf("unexpected fallback phase text: %q", got)
	}
}

func TestKindCluster_HandleKindAndDockerProgressLines(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	a.handleKindCreateLine("Using image \"kindest/node:v1.29.4\"", kp)
	if kp.image != "kindest/node:v1.29.4" {
		t.Fatalf("expected image to be captured, got %q", kp.image)
	}
	a.handleKindCreateLine("downloading: 50 MiB / 100 MiB", kp)
	if kp.lastPullPercent < 50 {
		t.Fatalf("expected pull percent to advance, got %d", kp.lastPullPercent)
	}

	dp := &dockerPullProgress{image: "kindest/node:v1.29.4", lastPercent: -1, layers: map[string]dockerLayerProgress{}}
	a.handleDockerPullLine("abc123: downloading 10 MB / 100 MB", dp)
	l := dp.layers["abc123"]
	if l.total == 0 || l.weight <= 20 {
		t.Fatalf("expected layer progress to be tracked, got %+v", l)
	}
	a.handleDockerPullLine("abc123: pull complete", dp)
	if dp.layers["abc123"].weight != 100 {
		t.Fatalf("expected terminal layer weight 100, got %d", dp.layers["abc123"].weight)
	}
}

func TestKindCluster_UpdateAndEmitPullProgressMonotonic(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{image: "img", lastPullPercent: -1, lastOverall: -1}
	a.emitKindPullProgress(10, kp, "Pulling image")
	firstOverall := kp.lastOverall
	a.emitKindPullProgress(5, kp, "Pulling image")
	if kp.lastOverall != firstOverall {
		t.Fatalf("expected non-increasing pull percent not to regress overall progress")
	}

	dp := &dockerPullProgress{layers: map[string]dockerLayerProgress{
		"l1": {weight: 100, phase: "pull complete", current: 10, total: 10},
		"l2": {weight: 50, phase: "downloading", current: 5, total: 10},
	}}
	a.updateDockerPullProgress(dp)
	if dp.lastPercent <= 40 {
		t.Fatalf("expected docker pull percent to move forward, got %d", dp.lastPercent)
	}
}

func TestKindCluster_StateTransitionsAndCancel(t *testing.T) {
	a := &App{}

	ctxOld, cancelOld := context.WithCancel(context.Background())
	_ = a.setKindCancel(cancelOld)
	newID := a.setKindCancel(func() {})
	select {
	case <-ctxOld.Done():
		// expected previous cancel invoked
	default:
		t.Fatal("expected prior kind cancel func to be invoked")
	}

	a.clearKindCancel(newID)
	if a.CancelKindCluster() {
		t.Fatal("expected CancelKindCluster to report false with no active cancel")
	}

	ctxActive, cancelActive := context.WithCancel(context.Background())
	a.kindCancel = cancelActive
	if !a.CancelKindCluster() {
		t.Fatal("expected CancelKindCluster to report true when cancel exists")
	}
	select {
	case <-ctxActive.Done():
		// expected
	case <-time.After(200 * time.Millisecond):
		t.Fatal("expected active cancel to be invoked")
	}
}

func TestKindCluster_ErrorPathsForExternalCommands(t *testing.T) {
	ctx := context.Background()

	if _, err := kindClusterExists(ctx, "definitely-not-a-real-kind-binary", "kdb-local"); err == nil {
		t.Fatal("expected error from kindClusterExists with invalid executable")
	}

	if _, err := kindImageExists(ctx, "definitely-not-a-real-docker-binary", kindNodeImage); err == nil {
		t.Fatal("expected error from kindImageExists with invalid executable")
	}
}
