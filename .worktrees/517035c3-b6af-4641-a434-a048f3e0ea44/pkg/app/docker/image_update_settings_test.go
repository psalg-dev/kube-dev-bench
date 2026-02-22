package docker

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDefaultImageUpdateSettings(t *testing.T) {
	s := DefaultImageUpdateSettings()
	if s.Enabled {
		t.Fatalf("expected default Enabled=false")
	}
	if s.IntervalSeconds != 300 {
		t.Fatalf("expected default IntervalSeconds=300 got %d", s.IntervalSeconds)
	}
	if s.Interval() != 300*time.Second {
		t.Fatalf("expected Interval()=300s got %v", s.Interval())
	}
}

func TestValidateImageUpdateSettings(t *testing.T) {
	cases := []struct {
		name string
		s    ImageUpdateSettings
		ok   bool
	}{
		{"zero", ImageUpdateSettings{Enabled: true, IntervalSeconds: 0}, false},
		{"too-low", ImageUpdateSettings{Enabled: true, IntervalSeconds: 10}, false},
		{"too-high", ImageUpdateSettings{Enabled: true, IntervalSeconds: 999999}, false},
		{"ok", ImageUpdateSettings{Enabled: true, IntervalSeconds: 60}, true},
	}

	for _, tc := range cases {
		err := validateImageUpdateSettings(tc.s)
		if tc.ok && err != nil {
			t.Fatalf("%s: expected ok, got err=%v", tc.name, err)
		}
		if !tc.ok && err == nil {
			t.Fatalf("%s: expected error", tc.name)
		}
	}
}

func TestSaveAndLoadImageUpdateSettings(t *testing.T) {
	tmp := t.TempDir()
	// os.UserHomeDir uses HOME on unix and USERPROFILE on Windows.
	t.Setenv("HOME", tmp)
	t.Setenv("USERPROFILE", tmp)

	path, err := imageUpdateSettingsPath()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// ensure clean
	_ = os.Remove(path)

	loaded, err := LoadImageUpdateSettings()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loaded.IntervalSeconds != 300 {
		t.Fatalf("expected default interval on missing file")
	}

	s := ImageUpdateSettings{Enabled: true, IntervalSeconds: 60}
	if err := SaveImageUpdateSettings(s); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// file should exist
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file at %s: %v", path, err)
	}
	// and be under temp HOME
	if filepath.Dir(filepath.Dir(path)) != tmp {
		// path is <home>/KubeDevBench/<file>
		t.Fatalf("expected settings path rooted in temp home, got %s", path)
	}

	loaded, err = LoadImageUpdateSettings()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loaded.Enabled != true || loaded.IntervalSeconds != 60 {
		t.Fatalf("unexpected loaded settings: %+v", loaded)
	}
}

func TestSaveImageUpdateSettings_DefaultsIntervalWhenZero(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	t.Setenv("USERPROFILE", tmp)

	if err := SaveImageUpdateSettings(ImageUpdateSettings{Enabled: true, IntervalSeconds: 0}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	loaded, err := LoadImageUpdateSettings()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loaded.IntervalSeconds != 300 {
		t.Fatalf("expected default intervalSeconds=300 got %d", loaded.IntervalSeconds)
	}
}
