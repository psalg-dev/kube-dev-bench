package registry

import (
	"net/url"
	"strings"
	"testing"
)

func TestSplitChallengeParams_CommaInQuotes(t *testing.T) {
	in := `realm="r",scope="a,b"`
	parts := splitChallengeParams(in)
	if len(parts) != 2 {
		t.Fatalf("expected 2 parts, got %d: %v", len(parts), parts)
	}
}

func TestParseChallengeParams_Basic(t *testing.T) {
	parts := []string{"realm=\"r\"", "service=\"s\""}
	ch := parseChallengeParams(parts)
	if ch.realm != "r" || ch.service != "s" {
		t.Fatalf("unexpected: %#v", ch)
	}
}

func TestParseImageManifestSize_SumsLayers(t *testing.T) {
	body := []byte(`{"schemaVersion":2,"layers":[{"size":10},{"size":15}]}`)
	sz, ok := parseImageManifestSize(body)
	if !ok || sz != 25 {
		t.Fatalf("unexpected: %d %v", sz, ok)
	}
}

func TestBuildRequestURL_JoinsPathsAndQuery(t *testing.T) {
	u, _ := url.Parse("https://host/base")
	c := &v2Client{baseURL: u}
	out := c.buildRequestURL("/v2/foo", nil)
	if !strings.Contains(out.Path, "base") || !strings.Contains(out.Path, "v2") {
		t.Fatalf("unexpected path: %s", out.Path)
	}
	q := make(url.Values)
	q.Set("a", "1")
	out2 := c.buildRequestURL("bar", q)
	if out2.RawQuery != "a=1" {
		t.Fatalf("unexpected query: %s", out2.RawQuery)
	}
}

func TestFormatErrorMessage_TrimsAndLimits(t *testing.T) {
	b := []byte("   ")
	if got := formatErrorMessage(b, "S"); got != "S" {
		t.Fatalf("expected fallback status, got %q", got)
	}
	long := []byte(strings.Repeat("x", 600))
	if len(formatErrorMessage(long, "S2")) != 512 {
		t.Fatalf("expected truncation")
	}
}
