package app

import (
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ---------------------------------------------------------------------------
// TestFormatHPAMetricStatus_AllBranches
// ---------------------------------------------------------------------------

func TestFormatHPAMetricStatus_AllBranches(t *testing.T) {
	t.Run("average value branch", func(t *testing.T) {
		val := resource.MustParse("150m")
		got := formatHPAMetricStatus(autoscalingv2.MetricValueStatus{AverageValue: &val})
		if got == "" {
			t.Error("expected non-empty for AverageValue branch")
		}
	})

	t.Run("value branch", func(t *testing.T) {
		val := resource.MustParse("2Gi")
		got := formatHPAMetricStatus(autoscalingv2.MetricValueStatus{Value: &val})
		if got == "" {
			t.Error("expected non-empty for Value branch")
		}
	})
}

// ---------------------------------------------------------------------------
// TestBuildDeploymentRevisions
// ---------------------------------------------------------------------------

func TestBuildDeploymentRevisions(t *testing.T) {
	t.Run("empty replicasets", func(t *testing.T) {
		result := buildDeploymentRevisions(nil, "my-deploy")
		if len(result) != 0 {
			t.Errorf("expected empty result, got %d", len(result))
		}
	})

	t.Run("replicaset not owned by deployment", func(t *testing.T) {
		rss := []appsv1.ReplicaSet{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name: "other-rs",
					OwnerReferences: []metav1.OwnerReference{
						{Kind: "Deployment", Name: "other-deploy"},
					},
				},
			},
		}
		result := buildDeploymentRevisions(rss, "my-deploy")
		if len(result) != 0 {
			t.Errorf("expected empty result for unowned RS, got %d", len(result))
		}
	})

	t.Run("owned replicaset with revision annotation", func(t *testing.T) {
		replicas := int32(3)
		rss := []appsv1.ReplicaSet{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name: "my-deploy-abc123",
					Annotations: map[string]string{
						"deployment.kubernetes.io/revision": "2",
					},
					OwnerReferences: []metav1.OwnerReference{
						{Kind: "Deployment", Name: "my-deploy"},
					},
				},
				Spec: appsv1.ReplicaSetSpec{
					Replicas: &replicas,
					Template: appsv1.ReplicaSetSpec{}.Template,
				},
			},
		}
		result := buildDeploymentRevisions(rss, "my-deploy")
		if len(result) != 1 {
			t.Fatalf("expected 1 result, got %d", len(result))
		}
		if result[0].Revision != 2 {
			t.Errorf("Revision=%d, want 2", result[0].Revision)
		}
		if result[0].Replicas != 3 {
			t.Errorf("Replicas=%d, want 3", result[0].Replicas)
		}
		if !result[0].IsCurrent {
			t.Error("IsCurrent should be true for replicas > 0")
		}
	})

	t.Run("owned replicaset without containers or revision", func(t *testing.T) {
		rss := []appsv1.ReplicaSet{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name: "my-deploy-xyz",
					OwnerReferences: []metav1.OwnerReference{
						{Kind: "Deployment", Name: "my-deploy"},
					},
				},
			},
		}
		result := buildDeploymentRevisions(rss, "my-deploy")
		if len(result) != 1 {
			t.Fatalf("expected 1 result, got %d", len(result))
		}
		if result[0].Revision != 0 {
			t.Errorf("expected revision 0 without annotation, got %d", result[0].Revision)
		}
		if result[0].Image != "" {
			t.Errorf("expected empty image for no containers, got %q", result[0].Image)
		}
		if result[0].IsCurrent {
			t.Error("IsCurrent should be false for 0 replicas")
		}
	})

	t.Run("owned replicaset with non-zero creation timestamp", func(t *testing.T) {
		rss := []appsv1.ReplicaSet{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "my-deploy-ts",
					CreationTimestamp: metav1.Now(),
					OwnerReferences: []metav1.OwnerReference{
						{Kind: "Deployment", Name: "my-deploy"},
					},
				},
			},
		}
		result := buildDeploymentRevisions(rss, "my-deploy")
		if len(result) != 1 {
			t.Fatalf("expected 1 result, got %d", len(result))
		}
		if result[0].CreatedAt == "-" {
			t.Error("expected non-zero timestamp string, got '-'")
		}
	})

	t.Run("invalid revision annotation falls back to 0", func(t *testing.T) {
		rss := []appsv1.ReplicaSet{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name: "my-deploy-bad",
					Annotations: map[string]string{
						"deployment.kubernetes.io/revision": "not-a-number",
					},
					OwnerReferences: []metav1.OwnerReference{
						{Kind: "Deployment", Name: "my-deploy"},
					},
				},
			},
		}
		result := buildDeploymentRevisions(rss, "my-deploy")
		if len(result) != 1 {
			t.Fatalf("expected 1, got %d", len(result))
		}
		if result[0].Revision != 0 {
			t.Errorf("expected 0 for invalid revision, got %d", result[0].Revision)
		}
	})
}
