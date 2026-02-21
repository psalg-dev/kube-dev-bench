package docker

import (
	"testing"
)

// ---------------------------------------------------------------------------
// filterNetworksByStack tests
// ---------------------------------------------------------------------------

func TestFilterNetworksByStack_MatchesLabel(t *testing.T) {
	t.Parallel()

	nets := []SwarmNetworkInfo{
		{ID: "n1", Name: "mystack_default", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "n2", Name: "other_net", Labels: map[string]string{"com.docker.stack.namespace": "otherstack"}},
		{ID: "n3", Name: "no_labels", Labels: map[string]string{}},
	}

	result := filterNetworksByStack(nets, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 network, got %d: %v", len(result), result)
	}
	if result[0].ID != "n1" {
		t.Errorf("expected n1, got %q", result[0].ID)
	}
}

func TestFilterNetworksByStack_EmptyInput(t *testing.T) {
	t.Parallel()

	result := filterNetworksByStack(nil, "mystack")
	if len(result) != 0 {
		t.Errorf("expected empty result for nil input, got %v", result)
	}
}

func TestFilterNetworksByStack_NoMatches(t *testing.T) {
	t.Parallel()

	nets := []SwarmNetworkInfo{
		{ID: "n1", Labels: map[string]string{"com.docker.stack.namespace": "otherstack"}},
	}

	result := filterNetworksByStack(nets, "mystack")
	if len(result) != 0 {
		t.Errorf("expected no matches, got %d", len(result))
	}
}

func TestFilterNetworksByStack_MultipleMatches(t *testing.T) {
	t.Parallel()

	nets := []SwarmNetworkInfo{
		{ID: "n1", Labels: map[string]string{"com.docker.stack.namespace": "prod"}},
		{ID: "n2", Labels: map[string]string{"com.docker.stack.namespace": "prod"}},
		{ID: "n3", Labels: map[string]string{"com.docker.stack.namespace": "dev"}},
	}

	result := filterNetworksByStack(nets, "prod")
	if len(result) != 2 {
		t.Errorf("expected 2 networks for prod, got %d", len(result))
	}
}

// ---------------------------------------------------------------------------
// filterConfigsByStack tests
// ---------------------------------------------------------------------------

func TestFilterConfigsByStack_MatchesLabel(t *testing.T) {
	t.Parallel()

	configs := []SwarmConfigInfo{
		{ID: "c1", Name: "mystack_config", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "c2", Name: "other_config", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}

	result := filterConfigsByStack(configs, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 config, got %d", len(result))
	}
	if result[0].ID != "c1" {
		t.Errorf("expected c1, got %q", result[0].ID)
	}
}

func TestFilterConfigsByStack_Empty(t *testing.T) {
	t.Parallel()

	result := filterConfigsByStack(nil, "mystack")
	if len(result) != 0 {
		t.Errorf("expected empty result, got %v", result)
	}
}

func TestFilterConfigsByStack_MultipleMatches(t *testing.T) {
	t.Parallel()

	configs := []SwarmConfigInfo{
		{ID: "c1", Labels: map[string]string{"com.docker.stack.namespace": "app"}},
		{ID: "c2", Labels: map[string]string{"com.docker.stack.namespace": "app"}},
		{ID: "c3", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}

	result := filterConfigsByStack(configs, "app")
	if len(result) != 2 {
		t.Errorf("expected 2 configs, got %d", len(result))
	}
}

// ---------------------------------------------------------------------------
// filterSecretsByStack tests
// ---------------------------------------------------------------------------

func TestFilterSecretsByStack_MatchesLabel(t *testing.T) {
	t.Parallel()

	secrets := []SwarmSecretInfo{
		{ID: "s1", Name: "mystack_secret", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{ID: "s2", Name: "other_secret", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}

	result := filterSecretsByStack(secrets, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 secret, got %d", len(result))
	}
	if result[0].ID != "s1" {
		t.Errorf("expected s1, got %q", result[0].ID)
	}
}

func TestFilterSecretsByStack_Empty(t *testing.T) {
	t.Parallel()

	result := filterSecretsByStack(nil, "mystack")
	if len(result) != 0 {
		t.Errorf("expected empty result, got %v", result)
	}
}

func TestFilterSecretsByStack_NoMatches(t *testing.T) {
	t.Parallel()

	secrets := []SwarmSecretInfo{
		{ID: "s1", Labels: map[string]string{"com.docker.stack.namespace": "prod"}},
	}

	result := filterSecretsByStack(secrets, "staging")
	if len(result) != 0 {
		t.Errorf("expected no matches, got %d", len(result))
	}
}

// ---------------------------------------------------------------------------
// filterVolumesByStack tests
// ---------------------------------------------------------------------------

func TestFilterVolumesByStack_LabelMatch(t *testing.T) {
	t.Parallel()

	vols := []SwarmVolumeInfo{
		{Name: "mystack_data", Labels: map[string]string{"com.docker.stack.namespace": "mystack"}},
		{Name: "other_vol", Labels: map[string]string{"com.docker.stack.namespace": "other"}},
	}

	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 volume by label, got %d", len(result))
	}
	if result[0].Name != "mystack_data" {
		t.Errorf("expected mystack_data, got %q", result[0].Name)
	}
}

func TestFilterVolumesByStack_PrefixMatch(t *testing.T) {
	t.Parallel()

	// Volume with no label but matching name prefix
	vols := []SwarmVolumeInfo{
		{Name: "mystack_data", Labels: map[string]string{}},
		{Name: "other_data", Labels: map[string]string{}},
	}

	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 1 {
		t.Fatalf("expected 1 volume by prefix, got %d: %v", len(result), result)
	}
	if result[0].Name != "mystack_data" {
		t.Errorf("expected mystack_data, got %q", result[0].Name)
	}
}

func TestFilterVolumesByStack_LabelAndPrefixDeduplication(t *testing.T) {
	t.Parallel()

	// Volume matches BOTH by label and prefix — should only appear once
	vols := []SwarmVolumeInfo{
		{
			Name:   "mystack_db",
			Labels: map[string]string{"com.docker.stack.namespace": "mystack"},
		},
	}

	result := filterVolumesByStack(vols, "mystack")
	if len(result) != 1 {
		t.Errorf("expected 1 volume (no duplicate), got %d", len(result))
	}
}

func TestFilterVolumesByStack_Empty(t *testing.T) {
	t.Parallel()

	result := filterVolumesByStack(nil, "mystack")
	if len(result) != 0 {
		t.Errorf("expected empty result for nil input, got %v", result)
	}
}

func TestFilterVolumesByStack_NoMatches(t *testing.T) {
	t.Parallel()

	vols := []SwarmVolumeInfo{
		{Name: "other_vol", Labels: map[string]string{"com.docker.stack.namespace": "prod"}},
		{Name: "not_a_match", Labels: map[string]string{}},
	}

	result := filterVolumesByStack(vols, "staging")
	if len(result) != 0 {
		t.Errorf("expected no matches, got %d: %v", len(result), result)
	}
}

func TestFilterVolumesByStack_MultipleMatches(t *testing.T) {
	t.Parallel()

	vols := []SwarmVolumeInfo{
		{Name: "prod_db", Labels: map[string]string{"com.docker.stack.namespace": "prod"}},
		{Name: "prod_cache", Labels: map[string]string{}}, // matches by prefix
		{Name: "staging_db", Labels: map[string]string{"com.docker.stack.namespace": "staging"}},
	}

	result := filterVolumesByStack(vols, "prod")
	if len(result) != 2 {
		t.Errorf("expected 2 prod volumes, got %d: %v", len(result), result)
	}
}
