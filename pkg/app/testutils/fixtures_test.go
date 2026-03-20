package testutils

import "testing"

func TestMakePod(t *testing.T) {
	pod := MakePod("default", "pod-a", "main")
	if pod.Name != "pod-a" {
		t.Fatalf("expected pod name %q, got %q", "pod-a", pod.Name)
	}
	if pod.Namespace != "default" {
		t.Fatalf("expected namespace %q, got %q", "default", pod.Namespace)
	}
	if len(pod.Spec.Containers) != 1 {
		t.Fatalf("expected 1 container, got %d", len(pod.Spec.Containers))
	}
	if pod.Spec.Containers[0].Name != "main" {
		t.Fatalf("expected container name %q, got %q", "main", pod.Spec.Containers[0].Name)
	}
}
