package docker

import (
	"testing"
)

// --- TestFilterNetworksByStack ---

func TestFilterNetworksByStack_mixedInputReturnsMatchingOnly(t *testing.T) {
	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "mystack_default", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "n2", Name: "other_net", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "n3", Name: "mystack_backend", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "n4", Name: "unlabeled"},
	}

	got := filterNetworksByStack(nets, "mystack")
	if len(got) != 2 {
		t.Fatalf("expected 2 networks, got %d", len(got))
	}
	for _, n := range got {
		if n.Labels["com.docker.stack.namespace"] != "mystack" {
			t.Errorf("unexpected network %q matched for stack 'mystack'", n.Name)
		}
	}
}

func TestFilterNetworksByStack_emptyInputReturnsEmpty(t *testing.T) {
	got := filterNetworksByStack([]SwarmNetworkInfo{}, "mystack")
	if len(got) != 0 {
		t.Errorf("expected empty result, got %d items", len(got))
	}
}

func TestFilterNetworksByStack_noMatchReturnsEmpty(t *testing.T) {
	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "other_net", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}
	got := filterNetworksByStack(nets, "mystack")
	if len(got) != 0 {
		t.Errorf("expected 0 results, got %d", len(got))
	}
}

// --- TestFilterConfigsByStack ---

func TestFilterConfigsByStack_mixedInputReturnsMatchingOnly(t *testing.T) {
	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "mystack_app_config", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "c2", Name: "other_config", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "c3", Name: "mystack_db_config", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "c4", Name: "no_label_config"},
	}

	got := filterConfigsByStack(configs, "mystack")
	if len(got) != 2 {
		t.Fatalf("expected 2 configs, got %d", len(got))
	}
	for _, c := range got {
		if c.Labels["com.docker.stack.namespace"] != "mystack" {
			t.Errorf("unexpected config %q matched for stack 'mystack'", c.Name)
		}
	}
}

func TestFilterConfigsByStack_emptyInputReturnsEmpty(t *testing.T) {
	got := filterConfigsByStack([]SwarmConfigInfo{}, "mystack")
	if len(got) != 0 {
		t.Errorf("expected empty result, got %d items", len(got))
	}
}

func TestFilterConfigsByStack_noMatchReturnsEmpty(t *testing.T) {
	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "other_config", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}
	got := filterConfigsByStack(configs, "mystack")
	if len(got) != 0 {
		t.Errorf("expected 0 results, got %d", len(got))
	}
}

// --- TestFilterSecretsByStack ---

func TestFilterSecretsByStack_mixedInputReturnsMatchingOnly(t *testing.T) {
	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "mystack_db_pass", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "s2", Name: "other_secret", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{ID: "s3", Name: "mystack_api_key", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "s4", Name: "no_label_secret"},
	}

	got := filterSecretsByStack(secrets, "mystack")
	if len(got) != 2 {
		t.Fatalf("expected 2 secrets, got %d", len(got))
	}
	for _, s := range got {
		if s.Labels["com.docker.stack.namespace"] != "mystack" {
			t.Errorf("unexpected secret %q matched for stack 'mystack'", s.Name)
		}
	}
}

func TestFilterSecretsByStack_emptyInputReturnsEmpty(t *testing.T) {
	got := filterSecretsByStack([]SwarmSecretInfo{}, "mystack")
	if len(got) != 0 {
		t.Errorf("expected empty result, got %d items", len(got))
	}
}

func TestFilterSecretsByStack_noMatchReturnsEmpty(t *testing.T) {
	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "other_secret", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}
	got := filterSecretsByStack(secrets, "mystack")
	if len(got) != 0 {
		t.Errorf("expected 0 results, got %d", len(got))
	}
}

// --- TestFilterVolumesByStack ---

func TestFilterVolumesByStack_matchesByLabel(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "some_vol", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{Name: "other_vol", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}

	got := filterVolumesByStack(vols, "mystack")
	if len(got) != 1 {
		t.Fatalf("expected 1 volume, got %d", len(got))
	}
	if got[0].Name != "some_vol" {
		t.Errorf("expected 'some_vol', got %q", got[0].Name)
	}
}

func TestFilterVolumesByStack_matchesByNamePrefix(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "mystack_data"},   // matches by prefix
		{Name: "mystack2_data"}, // different stack name, should NOT match prefix
		{Name: "other_data"},
	}

	got := filterVolumesByStack(vols, "mystack")
	if len(got) != 1 {
		t.Fatalf("expected 1 volume (prefix match only), got %d: %v", len(got), got)
	}
	if got[0].Name != "mystack_data" {
		t.Errorf("expected 'mystack_data', got %q", got[0].Name)
	}
}

func TestFilterVolumesByStack_labelTakesPrecedenceOverPrefix(t *testing.T) {
	vols := []SwarmVolumeInfo{
		// Both label and prefix match
		{Name: "mystack_data", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
	}

	got := filterVolumesByStack(vols, "mystack")
	// Should appear exactly once (label match path exits early via continue)
	if len(got) != 1 {
		t.Fatalf("expected 1 volume, got %d", len(got))
	}
}

func TestFilterVolumesByStack_emptyInputReturnsEmpty(t *testing.T) {
	got := filterVolumesByStack([]SwarmVolumeInfo{}, "mystack")
	if len(got) != 0 {
		t.Errorf("expected empty result, got %d items", len(got))
	}
}

func TestFilterVolumesByStack_noMatchReturnsEmpty(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "other_vol", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
		{Name: "unrelated"},
	}
	got := filterVolumesByStack(vols, "mystack")
	if len(got) != 0 {
		t.Errorf("expected 0 results, got %d", len(got))
	}
}

func TestFilterVolumesByStack_mixedLabelAndPrefixMatches(t *testing.T) {
	vols := []SwarmVolumeInfo{
		{Name: "mystack_alpha", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{Name: "mystack_beta"}, // prefix only, no label
		{Name: "mystack2_gamma"},
		{Name: "other_vol", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}

	got := filterVolumesByStack(vols, "mystack")
	if len(got) != 2 {
		t.Fatalf("expected 2 volumes, got %d: %v", len(got), got)
	}
}
