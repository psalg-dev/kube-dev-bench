package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── checkDeploymentIssues ───────────────────────────────────────────────────

func TestCheckDeploymentIssues_NoDeployments(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	issues := app.checkDeploymentIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues, got %d", len(issues))
	}
}

func TestCheckDeploymentIssues_HealthyDeployment(t *testing.T) {
	replicas := int32(2)
	clientset := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{Replicas: &replicas},
		Status:     appsv1.DeploymentStatus{ReadyReplicas: 2},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkDeploymentIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues for healthy deployment, got %d", len(issues))
	}
}

func TestCheckDeploymentIssues_UnavailableReplicas(t *testing.T) {
	replicas := int32(3)
	clientset := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "api", Namespace: "prod"},
		Spec:       appsv1.DeploymentSpec{Replicas: &replicas},
		Status:     appsv1.DeploymentStatus{ReadyReplicas: 1},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkDeploymentIssues(clientset, context.Background(), "prod")
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].Resource != "Deployment" {
		t.Errorf("expected resource Deployment, got %s", issues[0].Resource)
	}
	if issues[0].Name != "api" {
		t.Errorf("expected name api, got %s", issues[0].Name)
	}
	if issues[0].Reason != "UnavailableReplicas" {
		t.Errorf("expected reason UnavailableReplicas, got %s", issues[0].Reason)
	}
	if issues[0].Type != "warning" {
		t.Errorf("expected type warning, got %s", issues[0].Type)
	}
}

func TestCheckDeploymentIssues_NilReplicasDefaultsToOne(t *testing.T) {
	// Spec.Replicas == nil → desired = 1; ReadyReplicas = 0 → issue
	clientset := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "solo", Namespace: "default"},
		Spec:       appsv1.DeploymentSpec{},
		Status:     appsv1.DeploymentStatus{ReadyReplicas: 0},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkDeploymentIssues(clientset, context.Background(), "default")
	if len(issues) != 1 {
		t.Errorf("expected 1 issue when nil replicas and ReadyReplicas=0, got %d", len(issues))
	}
}

// ─── checkStatefulSetIssues ──────────────────────────────────────────────────

func TestCheckStatefulSetIssues_NoStatefulSets(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	issues := app.checkStatefulSetIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues, got %d", len(issues))
	}
}

func TestCheckStatefulSetIssues_HealthyStatefulSet(t *testing.T) {
	replicas := int32(2)
	clientset := fake.NewSimpleClientset(&appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
		Spec:       appsv1.StatefulSetSpec{Replicas: &replicas},
		Status:     appsv1.StatefulSetStatus{ReadyReplicas: 2},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkStatefulSetIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues for healthy statefulset, got %d", len(issues))
	}
}

func TestCheckStatefulSetIssues_UnavailableReplicas(t *testing.T) {
	replicas := int32(3)
	clientset := fake.NewSimpleClientset(&appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "redis", Namespace: "cache"},
		Spec:       appsv1.StatefulSetSpec{Replicas: &replicas},
		Status:     appsv1.StatefulSetStatus{ReadyReplicas: 0},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkStatefulSetIssues(clientset, context.Background(), "cache")
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].Resource != "StatefulSet" {
		t.Errorf("expected resource StatefulSet, got %s", issues[0].Resource)
	}
	if issues[0].Name != "redis" {
		t.Errorf("expected name redis, got %s", issues[0].Name)
	}
	if issues[0].Reason != "UnavailableReplicas" {
		t.Errorf("expected reason UnavailableReplicas, got %s", issues[0].Reason)
	}
}

func TestCheckStatefulSetIssues_NilReplicasDefaultsToOne(t *testing.T) {
	clientset := fake.NewSimpleClientset(&appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "solo-sts", Namespace: "default"},
		Spec:       appsv1.StatefulSetSpec{},
		Status:     appsv1.StatefulSetStatus{ReadyReplicas: 0},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkStatefulSetIssues(clientset, context.Background(), "default")
	if len(issues) != 1 {
		t.Errorf("expected 1 issue when nil replicas and ReadyReplicas=0, got %d", len(issues))
	}
}

// ─── checkDaemonSetIssues ────────────────────────────────────────────────────

func TestCheckDaemonSetIssues_NoDaemonSets(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	issues := app.checkDaemonSetIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues, got %d", len(issues))
	}
}

func TestCheckDaemonSetIssues_HealthyDaemonSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(&appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "fluent", Namespace: "kube-system"},
		Status: appsv1.DaemonSetStatus{
			DesiredNumberScheduled: 3,
			NumberReady:            3,
		},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkDaemonSetIssues(clientset, context.Background(), "kube-system")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues for healthy daemonset, got %d", len(issues))
	}
}

func TestCheckDaemonSetIssues_UnavailablePods(t *testing.T) {
	clientset := fake.NewSimpleClientset(&appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "monitor", Namespace: "ops"},
		Status: appsv1.DaemonSetStatus{
			DesiredNumberScheduled: 4,
			NumberReady:            2,
		},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkDaemonSetIssues(clientset, context.Background(), "ops")
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].Resource != "DaemonSet" {
		t.Errorf("expected resource DaemonSet, got %s", issues[0].Resource)
	}
	if issues[0].Name != "monitor" {
		t.Errorf("expected name monitor, got %s", issues[0].Name)
	}
	if issues[0].Reason != "UnavailablePods" {
		t.Errorf("expected reason UnavailablePods, got %s", issues[0].Reason)
	}
	if issues[0].Type != "warning" {
		t.Errorf("expected type warning, got %s", issues[0].Type)
	}
}

// ─── checkResourceQuotaIssues ────────────────────────────────────────────────

func TestCheckResourceQuotaIssues_NoQuotas(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	issues := app.checkResourceQuotaIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues, got %d", len(issues))
	}
}

func TestCheckResourceQuotaIssues_WithinLimits(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{Name: "team-quota", Namespace: "team-a"},
		Status: v1.ResourceQuotaStatus{
			Hard: v1.ResourceList{
				v1.ResourceCPU: resource.MustParse("10"),
			},
			Used: v1.ResourceList{
				v1.ResourceCPU: resource.MustParse("5"),
			},
		},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkResourceQuotaIssues(clientset, context.Background(), "team-a")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues when within quota, got %d", len(issues))
	}
}

func TestCheckResourceQuotaIssues_QuotaExceeded(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{Name: "tight-quota", Namespace: "team-b"},
		Status: v1.ResourceQuotaStatus{
			Hard: v1.ResourceList{
				v1.ResourceCPU: resource.MustParse("4"),
			},
			Used: v1.ResourceList{
				v1.ResourceCPU: resource.MustParse("4"), // used == hard → exceeded
			},
		},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkResourceQuotaIssues(clientset, context.Background(), "team-b")
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].Resource != "ResourceQuota" {
		t.Errorf("expected resource ResourceQuota, got %s", issues[0].Resource)
	}
	if issues[0].Name != "tight-quota" {
		t.Errorf("expected name tight-quota, got %s", issues[0].Name)
	}
	if issues[0].Reason != "QuotaExceeded" {
		t.Errorf("expected reason QuotaExceeded, got %s", issues[0].Reason)
	}
	if issues[0].Type != "warning" {
		t.Errorf("expected type warning, got %s", issues[0].Type)
	}
}

func TestCheckResourceQuotaIssues_UsedResourceNotInHard(t *testing.T) {
	// Quota has resource in used but not in hard → ok=false branch, skipped
	clientset := fake.NewSimpleClientset(&v1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{Name: "partial-quota", Namespace: "default"},
		Status: v1.ResourceQuotaStatus{
			Hard: v1.ResourceList{
				v1.ResourceCPU: resource.MustParse("10"),
			},
			Used: v1.ResourceList{
				v1.ResourceMemory: resource.MustParse("1Gi"), // not in Hard
			},
		},
	})
	app := &App{ctx: context.Background()}
	issues := app.checkResourceQuotaIssues(clientset, context.Background(), "default")
	if len(issues) != 0 {
		t.Errorf("expected 0 issues when used resource has no hard limit, got %d", len(issues))
	}
}

// ─── checkPVIssues ───────────────────────────────────────────────────────────

func TestCheckPVIssues_NoPVs(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkPVIssues(clientset, context.Background())
	if len(warnings) != 0 || len(errors) != 0 {
		t.Errorf("expected 0 warnings and 0 errors, got %d/%d", len(warnings), len(errors))
	}
}

func TestCheckPVIssues_BoundPV(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pv-bound"},
		Status:     v1.PersistentVolumeStatus{Phase: v1.VolumeBound},
	})
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkPVIssues(clientset, context.Background())
	if len(warnings) != 0 || len(errors) != 0 {
		t.Errorf("expected no issues for bound PV, got warnings=%d errors=%d", len(warnings), len(errors))
	}
}

func TestCheckPVIssues_FailedPV(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pv-failed"},
		Status: v1.PersistentVolumeStatus{
			Phase:   v1.VolumeFailed,
			Message: "backend storage unavailable",
		},
	})
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkPVIssues(clientset, context.Background())
	if len(errors) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errors))
	}
	if errors[0].Resource != "PersistentVolume" {
		t.Errorf("expected resource PersistentVolume, got %s", errors[0].Resource)
	}
	if errors[0].Name != "pv-failed" {
		t.Errorf("expected name pv-failed, got %s", errors[0].Name)
	}
	if errors[0].Reason != "VolumeFailed" {
		t.Errorf("expected reason VolumeFailed, got %s", errors[0].Reason)
	}
	if errors[0].Type != "error" {
		t.Errorf("expected type error, got %s", errors[0].Type)
	}
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings, got %d", len(warnings))
	}
}

func TestCheckPVIssues_PendingPV(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pv-pending"},
		Status: v1.PersistentVolumeStatus{
			Phase:   v1.VolumePending,
			Message: "waiting for storage provisioner",
		},
	})
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkPVIssues(clientset, context.Background())
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}
	if warnings[0].Resource != "PersistentVolume" {
		t.Errorf("expected resource PersistentVolume, got %s", warnings[0].Resource)
	}
	if warnings[0].Name != "pv-pending" {
		t.Errorf("expected name pv-pending, got %s", warnings[0].Name)
	}
	if warnings[0].Reason != "VolumePending" {
		t.Errorf("expected reason VolumePending, got %s", warnings[0].Reason)
	}
	if warnings[0].Type != "warning" {
		t.Errorf("expected type warning, got %s", warnings[0].Type)
	}
	if len(errors) != 0 {
		t.Errorf("expected 0 errors, got %d", len(errors))
	}
}

func TestCheckPVIssues_MixedPVs(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&v1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{Name: "pv-failed"},
			Status:     v1.PersistentVolumeStatus{Phase: v1.VolumeFailed},
		},
		&v1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{Name: "pv-pending"},
			Status:     v1.PersistentVolumeStatus{Phase: v1.VolumePending},
		},
		&v1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{Name: "pv-ok"},
			Status:     v1.PersistentVolumeStatus{Phase: v1.VolumeBound},
		},
	)
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkPVIssues(clientset, context.Background())
	if len(errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(errors))
	}
	if len(warnings) != 1 {
		t.Errorf("expected 1 warning, got %d", len(warnings))
	}
}

// ─── checkNodeIssues ─────────────────────────────────────────────────────────

func TestCheckNodeIssues_NoNodes(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkNodeIssues(clientset, context.Background())
	if len(warnings) != 0 || len(errors) != 0 {
		t.Errorf("expected 0 issues, got warnings=%d errors=%d", len(warnings), len(errors))
	}
}

func TestCheckNodeIssues_ReadyNode(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: "node-1"},
		Status: v1.NodeStatus{
			Conditions: []v1.NodeCondition{
				{Type: v1.NodeReady, Status: v1.ConditionTrue},
			},
		},
	})
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkNodeIssues(clientset, context.Background())
	if len(warnings) != 0 || len(errors) != 0 {
		t.Errorf("expected 0 issues for ready node, got warnings=%d errors=%d", len(warnings), len(errors))
	}
}

func TestCheckNodeIssues_NotReadyNode(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: "node-down"},
		Status: v1.NodeStatus{
			Conditions: []v1.NodeCondition{
				{
					Type:    v1.NodeReady,
					Status:  v1.ConditionFalse,
					Message: "kubelet stopped posting node status",
				},
			},
		},
	})
	app := &App{ctx: context.Background()}
	_, errors := app.checkNodeIssues(clientset, context.Background())
	if len(errors) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errors))
	}
	if errors[0].Resource != "Node" {
		t.Errorf("expected resource Node, got %s", errors[0].Resource)
	}
	if errors[0].Reason != "NotReady" {
		t.Errorf("expected reason NotReady, got %s", errors[0].Reason)
	}
	if errors[0].Type != "error" {
		t.Errorf("expected type error, got %s", errors[0].Type)
	}
}

func TestCheckNodeIssues_PressureCondition(t *testing.T) {
	clientset := fake.NewSimpleClientset(&v1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: "node-pressure"},
		Status: v1.NodeStatus{
			Conditions: []v1.NodeCondition{
				{Type: v1.NodeReady, Status: v1.ConditionTrue},
				{
					Type:    v1.NodeMemoryPressure,
					Status:  v1.ConditionTrue,
					Message: "memory usage is high",
				},
			},
		},
	})
	app := &App{ctx: context.Background()}
	warnings, errors := app.checkNodeIssues(clientset, context.Background())
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning for pressure condition, got %d", len(warnings))
	}
	if warnings[0].Resource != "Node" {
		t.Errorf("expected resource Node, got %s", warnings[0].Resource)
	}
	if len(errors) != 0 {
		t.Errorf("expected 0 errors, got %d", len(errors))
	}
}
