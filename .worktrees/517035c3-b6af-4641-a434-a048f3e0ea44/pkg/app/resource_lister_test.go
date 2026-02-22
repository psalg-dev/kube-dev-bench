package app

import (
	"context"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

func TestListResources_EmptyNamespace(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{
		ctx:           context.Background(),
		testClientset: cs,
	}

	type testItem struct{ Name string }
	results, err := listResources(app, "default",
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]testItem, error) {
			return nil, nil
		},
		func(item *testItem, now time.Time) string {
			return item.Name
		},
	)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestListResources_TransformsItems(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{
		ctx:           context.Background(),
		testClientset: cs,
	}

	type rawItem struct{ Value int }
	type result struct{ Doubled int }

	items := []rawItem{{Value: 1}, {Value: 2}, {Value: 3}}

	results, err := listResources(app, "default",
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]rawItem, error) {
			return items, nil
		},
		func(item *rawItem, now time.Time) result {
			return result{Doubled: item.Value * 2}
		},
	)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	for i, r := range results {
		expected := (i + 1) * 2
		if r.Doubled != expected {
			t.Errorf("results[%d].Doubled = %d, want %d", i, r.Doubled, expected)
		}
	}
}

func TestListResources_PropagatesListError(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{
		ctx:           context.Background(),
		testClientset: cs,
	}

	type item struct{ Name string }
	_, err := listResources(app, "default",
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]item, error) {
			return nil, context.DeadlineExceeded
		},
		func(item *item, now time.Time) string {
			return item.Name
		},
	)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err != context.DeadlineExceeded {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
}

func TestListClusterResources_TransformsItems(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{
		ctx:           context.Background(),
		testClientset: cs,
	}

	type rawItem struct{ ID string }
	items := []rawItem{{ID: "a"}, {ID: "b"}}

	results, err := listClusterResources(app,
		func(cs kubernetes.Interface, opts metav1.ListOptions) ([]rawItem, error) {
			return items, nil
		},
		func(item *rawItem, now time.Time) string {
			return item.ID
		},
	)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0] != "a" || results[1] != "b" {
		t.Errorf("unexpected results: %v", results)
	}
}

func TestListResources_NoClientReturnsError(t *testing.T) {
	app := &App{
		ctx: context.Background(),
		// no testClientset, no kubeconfig → getClient() will fail
	}

	type item struct{}
	_, err := listResources(app, "default",
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]item, error) {
			t.Fatal("listFn should not be called when getClient fails")
			return nil, nil
		},
		func(item *item, now time.Time) string { return "" },
	)

	if err == nil {
		t.Fatal("expected error when client is unavailable")
	}
}
