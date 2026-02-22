package docker

import (
	"testing"
)

// ---- filterNetworksByStack ----

func TestFilterNetworksByStack_AllMatch(t *testing.T) {
	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "net1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "n2", Name: "net2", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
	}
	result := filterNetworksByStack(nets, "mystack")
	if len(result) != 2 {
		t.Errorf("expected 2 networks, got %d", len(result))
	}
}

func TestFilterNetworksByStack_NoneMatch(t *testing.T) {
	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "net1", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "n2", Name: "net2", Labels: map[string]string{}},
	}
	result := filterNetworksByStack(nets, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 networks, got %d", len(result))
	}
}

func TestFilterNetworksByStack_Mixed(t *testing.T) {
	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "net1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "n2", Name: "net2", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "n3", Name: "net3", Labels: map[string]string{}},
	}
	result := filterNetworksByStack(nets, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 network, got %d", len(result))
	}
	if result[0].ID != "n1" {
		t.Errorf("expected network n1, got %q", result[0].ID)
	}
}

func TestFilterNetworksByStack_Empty(t *testing.T) {
	result := filterNetworksByStack(nil, "mystack")
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestFilterNetworksByStack_NoLabels(t *testing.T) {
	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "net1", Labels: nil},
	}
	result := filterNetworksByStack(nets, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 networks for nil labels, got %d", len(result))
	}
}

// ---- filterConfigsByStack ----

func TestFilterConfigsByStack_AllMatch(t *testing.T) {
	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "cfg1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "c2", Name: "cfg2", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
	}
	result := filterConfigsByStack(configs, "mystack")
	if len(result) != 2 {
		t.Errorf("expected 2 configs, got %d", len(result))
	}
}

func TestFilterConfigsByStack_NoneMatch(t *testing.T) {
	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "cfg1", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "c2", Name: "cfg2", Labels: map[string]string{}},
	}
	result := filterConfigsByStack(configs, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 configs, got %d", len(result))
	}
}

func TestFilterConfigsByStack_Mixed(t *testing.T) {
	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "cfg1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "c2", Name: "cfg2", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "c3", Name: "cfg3", Labels: nil},
	}
	result := filterConfigsByStack(configs, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 config, got %d", len(result))
	}
	if result[0].ID != "c1" {
		t.Errorf("expected config c1, got %q", result[0].ID)
	}
}

func TestFilterConfigsByStack_Empty(t *testing.T) {
	result := filterConfigsByStack(nil, "mystack")
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestFilterConfigsByStack_NoLabels(t *testing.T) {
	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "cfg1", Labels: nil},
	}
	result := filterConfigsByStack(configs, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 configs for nil labels, got %d", len(result))
	}
}

// ---- filterSecretsByStack ----

func TestFilterSecretsByStack_AllMatch(t *testing.T) {
	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "sec1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "s2", Name: "sec2", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
	}
	result := filterSecretsByStack(secrets, "mystack")
	if len(result) != 2 {
		t.Errorf("expected 2 secrets, got %d", len(result))
	}
}

func TestFilterSecretsByStack_NoneMatch(t *testing.T) {
	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "sec1", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "s2", Name: "sec2", Labels: map[string]string{}},
	}
	result := filterSecretsByStack(secrets, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 secrets, got %d", len(result))
	}
}

func TestFilterSecretsByStack_Mixed(t *testing.T) {
	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "sec1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "s2", Name: "sec2", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "s3", Name: "sec3", Labels: nil},
	}
	result := filterSecretsByStack(secrets, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 secret, got %d", len(result))
	}
	if result[0].ID != "s1" {
		t.Errorf("expected secret s1, got %q", result[0].ID)
	}
}

func TestFilterSecretsByStack_Empty(t *testing.T) {
	result := filterSecretsByStack(nil, "mystack")
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestFilterSecretsByStack_NoLabels(t *testing.T) {
	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "sec1", Labels: nil},
	}
	result := filterSecretsByStack(secrets, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 secrets for nil labels, got %d", len(result))
	}
}

// ---- filterVolumesByStack ----

func TestFilterVolumesByStack_AllMatchByLabel(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "vol1", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{Name: "vol2", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
	}
	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 2 {
		t.Errorf("expected 2 volumes, got %d", len(result))
	}
}

func TestFilterVolumesByStack_AllMatchByPrefix(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "mystack_vol1", Labels: nil},
		{Name: "mystack_vol2", Labels: map[string]string{}},
	}
	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 2 {
		t.Errorf("expected 2 volumes by prefix, got %d", len(result))
	}
}

func TestFilterVolumesByStack_NoneMatch(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "other_vol1", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{Name: "standalone", Labels: map[string]string{}},
	}
	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 volumes, got %d", len(result))
	}
}

func TestFilterVolumesByStack_Mixed(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "mystack_data", Labels: nil},                                                                      // matches by prefix
		{Name: "labeled", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},                   // matches by label
		{Name: "other_vol", Labels: map[string]string{"com.docker.stack.namespace": "other"}},                   // no match
		{Name: "standalone", Labels: map[string]string{}},                                                       // no match
		{Name: "mystack", Labels: nil},                                                                          // no match: exact name, no prefix separator
	}
	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 2 {
		t.Fatalf("expected 2 volumes, got %d: %v", len(result), result)
	}
}

func TestFilterVolumesByStack_LabelTakesPrecedence(t *testing.T) {
	// volume matches both by label AND by prefix — should appear exactly once
	vols := []SwarmVolumeInfo{
		{
			Name:   "mystack_data",
			Labels: map[string]string{"com.docker.stack.namespace": "mystack"},
		},
	}
	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 1 {
		t.Errorf("expected 1 volume (not duplicated), got %d", len(result))
	}
}

func TestFilterVolumesByStack_Empty(t *testing.T) {
	result := filterVolumesByStack(nil, "mystack")
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestFilterVolumesByStack_ShortName(t *testing.T) {
	// Name shorter than prefix "mystack_" — must not panic
	vols := []SwarmVolumeInfo{
		{Name: "my", Labels: nil},
	}
	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 0 {
		t.Errorf("expected 0 volumes for short name, got %d", len(result))
	}
}
