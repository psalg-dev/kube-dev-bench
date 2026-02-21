package docker

import "testing"

func TestPrettyJSON(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		if got := prettyJSON(nil); got != "" {
			t.Fatalf("expected empty string")
		}
		if got := prettyJSON([]byte("   \n\t")); got != "" {
			t.Fatalf("expected empty string")
		}
	})

	t.Run("invalid json returns raw", func(t *testing.T) {
		raw := []byte("not-json")
		if got := prettyJSON(raw); got != "not-json" {
			t.Fatalf("expected raw returned, got %q", got)
		}
	})

	t.Run("valid json pretty prints", func(t *testing.T) {
		raw := []byte("{\"a\":1,\"b\":{\"c\":2}}")
		out := prettyJSON(raw)
		if out == string(raw) {
			t.Fatalf("expected pretty printed output")
		}
		if out != "{\n  \"a\": 1,\n  \"b\": {\n    \"c\": 2\n  }\n}" {
			t.Fatalf("unexpected output: %q", out)
		}
	})
}
