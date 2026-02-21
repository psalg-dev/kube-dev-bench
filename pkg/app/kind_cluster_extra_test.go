package app

import (
	"testing"
)

// TestHandleKindCreateLine_EmptyLine tests the early return for empty/whitespace input.
func TestHandleKindCreateLine_EmptyLine(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	// Empty string should return early without modifying progress
	a.handleKindCreateLine("", kp)
	a.handleKindCreateLine("   \t  ", kp)
	// No panic, lastPullPercent stays at -1
	if kp.lastPullPercent != -1 {
		t.Errorf("expected no progress update for empty lines, got %d", kp.lastPullPercent)
	}
}

// TestHandleKindCreateLine_ImageAnnotation tests the kindImageRegex branch.
func TestHandleKindCreateLine_ImageAnnotation(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	// kindImageRegex: (?i)\bimage:\s*"?([^\s"]+)"?
	a.handleKindCreateLine(`image: "kindest/node:v1.28.0"`, kp)
	if kp.image != "kindest/node:v1.28.0" {
		t.Errorf("expected image captured from image: annotation, got %q", kp.image)
	}
}

// TestHandleKindCreateLine_PullingImageRegex tests the kindPullingRegex branch
// (different from the "contains pulling image" string check below it).
func TestHandleKindCreateLine_PullingImageRegex(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{image: "", lastPullPercent: -1, lastOverall: -1}
	// kindPullingRegex: (?i)pulling image\s+"?([^\s"]+)"?
	a.handleKindCreateLine(`pulling image "kindest/node:v1.29.4"`, kp)
	if kp.image != "kindest/node:v1.29.4" {
		t.Errorf("expected image captured from pulling image line, got %q", kp.image)
	}
	// Also should have emitted pull progress (lastPullPercent >= 0)
	if kp.lastPullPercent < 0 {
		t.Errorf("expected pull percent to update, got %d", kp.lastPullPercent)
	}
}

// TestHandleKindCreateLine_PullingImageContains tests the "contains pulling image"
// fallback branch (no regex match but string contains "pulling image").
func TestHandleKindCreateLine_PullingImageContains(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	// This line does NOT match kindPullingRegex (no image URL) but contains "pulling image"
	a.handleKindCreateLine("Pulling image layers from registry", kp)
	if kp.lastPullPercent < 0 {
		t.Errorf("expected pull percent to update for 'pulling image' line, got %d", kp.lastPullPercent)
	}
}

// TestHandleKindCreateLine_DownloadingContains tests the "contains downloading"
// fallback branch (no full regex match but string contains "downloading").
func TestHandleKindCreateLine_DownloadingContains(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	// String contains "downloading" but doesn't match the full byte-progress regex
	a.handleKindCreateLine("Downloading metadata", kp)
	if kp.lastPullPercent < 0 {
		t.Errorf("expected pull percent to update for 'downloading' line, got %d", kp.lastPullPercent)
	}
}

// TestHandleKindCreateLine_ExtractingContains tests the "contains extracting" branch.
func TestHandleKindCreateLine_ExtractingContains(t *testing.T) {
	a := &App{}
	kp := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	a.handleKindCreateLine("Extracting image archive", kp)
	if kp.lastPullPercent < 0 {
		t.Errorf("expected pull percent to update for 'extracting' line, got %d", kp.lastPullPercent)
	}
}
