package app

import (
	"strings"
	"testing"
	"time"

	"gowails/pkg/app/k8s_graph"
)

func TestGraph_NormalizeGraphDepth(t *testing.T) {
	if got := normalizeGraphDepth(0); got != k8s_graph.DefaultDepth {
		t.Fatalf("expected default depth %d, got %d", k8s_graph.DefaultDepth, got)
	}
	if got := normalizeGraphDepth(k8s_graph.MaxDepth + 10); got != k8s_graph.MaxDepth {
		t.Fatalf("expected max depth %d, got %d", k8s_graph.MaxDepth, got)
	}
	if got := normalizeGraphDepth(3); got != 3 {
		t.Fatalf("expected depth 3, got %d", got)
	}
}

func TestGraph_CloneResourceGraph_DeepCopies(t *testing.T) {
	original := &k8s_graph.ResourceGraph{
		Nodes: []k8s_graph.GraphNode{{
			ID:       "n1",
			Kind:     "pod",
			Metadata: map[string]string{"key": "value"},
		}},
		Edges: []k8s_graph.GraphEdge{{Source: "n1", Target: "n2", Type: k8s_graph.EdgeTypeOwns}},
	}

	clone := cloneResourceGraph(original)
	if clone == nil {
		t.Fatal("expected non-nil clone")
	}
	if &clone.Nodes[0] == &original.Nodes[0] {
		t.Fatal("expected node structs to be copied")
	}
	if clone.Nodes[0].Metadata["key"] != "value" {
		t.Fatalf("expected metadata value to be preserved, got %q", clone.Nodes[0].Metadata["key"])
	}

	original.Nodes[0].Metadata["key"] = "changed"
	original.Edges[0].Type = "changed"
	if clone.Nodes[0].Metadata["key"] != "value" {
		t.Fatal("expected cloned metadata to be independent from original")
	}
	if clone.Edges[0].Type != "owns" {
		t.Fatal("expected cloned edges to be independent from original")
	}

	if got := cloneResourceGraph(nil); got != nil {
		t.Fatal("expected nil clone for nil graph")
	}
}

func TestGraph_CacheRoundTripAndExpiration(t *testing.T) {
	app := NewApp()
	app.currentKubeContext = "ctx-a"

	key := app.graphCacheKey("resource", "default", "pod", "mypod", "2")
	if !strings.Contains(key, "resource|ctx-a|default|pod|mypod|2") {
		t.Fatalf("unexpected cache key: %q", key)
	}

	graph := &k8s_graph.ResourceGraph{
		Nodes: []k8s_graph.GraphNode{{ID: "n1", Metadata: map[string]string{"a": "1"}}},
	}
	app.setCachedGraph(key, graph)

	cached, ok := app.getCachedGraph(key)
	if !ok || cached == nil {
		t.Fatal("expected cached graph to be found")
	}
	graph.Nodes[0].Metadata["a"] = "2"
	if cached.Nodes[0].Metadata["a"] != "1" {
		t.Fatal("expected cached graph copy to be independent from source")
	}

	expiredKey := "expired"
	app.graphCache.Store(expiredKey, graphCacheEntry{graph: graph, expiresAt: time.Now().Add(-time.Second)})
	if _, ok := app.getCachedGraph(expiredKey); ok {
		t.Fatal("expected expired cache entry to miss")
	}

	badKey := "bad"
	app.graphCache.Store(badKey, "invalid")
	if _, ok := app.getCachedGraph(badKey); ok {
		t.Fatal("expected invalid cache entry type to miss")
	}
}

func TestGraph_ValidationErrors(t *testing.T) {
	app := NewApp()

	if _, err := app.GetResourceGraph("default", "", "x", 1); err == nil || !strings.Contains(err.Error(), "kind is required") {
		t.Fatalf("expected kind validation error, got %v", err)
	}
	if _, err := app.GetResourceGraph("default", "pod", "", 1); err == nil || !strings.Contains(err.Error(), "name is required") {
		t.Fatalf("expected name validation error, got %v", err)
	}
	if _, err := app.GetResourceGraph("", "namespace", "", 1); err == nil || !strings.Contains(err.Error(), "failed to get Kubernetes client") {
		t.Fatalf("expected Kubernetes client error for namespace graph build path, got %v", err)
	}

	if _, err := app.GetNamespaceGraph("", 1); err == nil {
		t.Fatal("expected namespace error for GetNamespaceGraph")
	}
	if _, err := app.GetStorageGraph("", 1); err == nil {
		t.Fatal("expected namespace error for GetStorageGraph")
	}
	if _, err := app.GetNetworkPolicyGraph("", 1); err == nil {
		t.Fatal("expected namespace error for GetNetworkPolicyGraph")
	}
	if _, err := app.GetRBACGraph(""); err == nil {
		t.Fatal("expected namespace error for GetRBACGraph")
	}
}
