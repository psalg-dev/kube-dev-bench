package app

import (
	"context"
	"testing"

	v1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetRefreshNamespaces_FallbackAndPreferred(t *testing.T) {
	a := &App{currentNamespace: "ns1"}
	got := a.getRefreshNamespaces()
	if len(got) != 1 || got[0] != "ns1" {
		t.Fatalf("fallback ns = %v", got)
	}
	a.preferredNamespaces = []string{"a", "b"}
	got = a.getRefreshNamespaces()
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("preferred ns = %v", got)
	}
}

func TestRefreshPodStatusOnly_AggregatesAndSkipsNoChange(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Pods("default").Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
		Status:     v1.PodStatus{Phase: v1.PodRunning},
	}, metav1.CreateOptions{})
	_, _ = cs.CoreV1().Pods("default").Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p2", Namespace: "default"},
		Status:     v1.PodStatus{Phase: v1.PodPending},
	}, metav1.CreateOptions{})

	a := &App{
		ctx:                 context.Background(),
		currentKubeContext:  "kind-kind",
		preferredNamespaces: []string{"default"},
		testClientset:       cs,
	}
	a.refreshPodStatusOnly()
	got := a.GetResourceCounts().PodStatus
	if got.Running != 1 || got.Pending != 1 || got.Total != 2 {
		t.Fatalf("agg = %+v", got)
	}

	before := a.GetResourceCounts()
	a.refreshPodStatusOnly()
	after := a.GetResourceCounts()
	if before != after {
		t.Fatalf("expected no change: before=%+v after=%+v", before, after)
	}
}

func TestRefreshResourceCounts_IncludesRBAC(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	cs := fake.NewSimpleClientset(
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "r1", Namespace: "default"}},
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "r2", Namespace: "default"}},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "rb1", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{Kind: "Role", Name: "r1", APIGroup: "rbac.authorization.k8s.io"},
		},
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr1"}},
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr2"}},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "crb1"},
			RoleRef:    rbacv1.RoleRef{Kind: "ClusterRole", Name: "cr1", APIGroup: "rbac.authorization.k8s.io"},
		},
	)

	a := &App{
		ctx:                 context.Background(),
		currentKubeContext:  "kind-kind",
		preferredNamespaces: []string{"default"},
		testClientset:       cs,
	}
	a.refreshResourceCounts()
	got := a.GetResourceCounts()
	if got.Roles != 2 || got.RoleBindings != 1 || got.ClusterRoles != 2 || got.ClusterRoleBindings != 1 {
		t.Fatalf("unexpected RBAC counts: %+v", got)
	}
}
