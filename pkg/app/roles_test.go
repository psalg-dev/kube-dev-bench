package app

import (
	"context"
	"testing"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetRoles_ReturnsRoles(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-role",
				Namespace: "default",
				Labels: map[string]string{
					"app": "myapp",
				},
				Annotations: map[string]string{
					"description": "test role",
				},
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{"pods"},
					Verbs:     []string{"get", "list"},
				},
				{
					APIGroups:     []string{"apps"},
					Resources:     []string{"deployments"},
					Verbs:         []string{"get", "list", "watch"},
					ResourceNames: []string{"my-deployment"},
				},
			},
		},
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "another-role",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	roles, err := app.GetRoles("default")
	if err != nil {
		t.Fatalf("GetRoles failed: %v", err)
	}

	if len(roles) != 2 {
		t.Fatalf("expected 2 roles, got %d", len(roles))
	}

	// Find the role by name
	var myRole *RoleInfo
	for i := range roles {
		if roles[i].Name == "my-role" {
			myRole = &roles[i]
			break
		}
	}

	if myRole == nil {
		t.Fatal("expected to find role 'my-role'")
	}

	// Verify role details
	if myRole.Namespace != "default" {
		t.Errorf("expected namespace 'default', got '%s'", myRole.Namespace)
	}
	if len(myRole.Rules) != 2 {
		t.Errorf("expected 2 rules, got %d", len(myRole.Rules))
	}
	if myRole.Labels["app"] != "myapp" {
		t.Errorf("expected label app=myapp, got %v", myRole.Labels)
	}
}

func TestGetRoles_NoRoles(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	roles, err := app.GetRoles("default")
	if err != nil {
		t.Fatalf("GetRoles failed: %v", err)
	}

	if len(roles) != 0 {
		t.Errorf("expected 0 roles, got %d", len(roles))
	}
}

func TestGetRoles_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetRoles("")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetClusterRoles_ReturnsClusterRoles(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{
				Name: "cluster-admin",
				Labels: map[string]string{
					"kubernetes.io/bootstrapping": "rbac-defaults",
				},
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{"*"},
					Resources: []string{"*"},
					Verbs:     []string{"*"},
				},
			},
		},
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{
				Name: "view",
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{"pods"},
					Verbs:     []string{"get", "list", "watch"},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	clusterRoles, err := app.GetClusterRoles()
	if err != nil {
		t.Fatalf("GetClusterRoles failed: %v", err)
	}

	if len(clusterRoles) != 2 {
		t.Fatalf("expected 2 cluster roles, got %d", len(clusterRoles))
	}

	// Verify first cluster role details
	if clusterRoles[0].Name != "cluster-admin" {
		t.Errorf("expected cluster role name 'cluster-admin', got '%s'", clusterRoles[0].Name)
	}
	if clusterRoles[0].Namespace != "" {
		t.Errorf("expected empty namespace for cluster role, got '%s'", clusterRoles[0].Namespace)
	}
	if len(clusterRoles[0].Rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(clusterRoles[0].Rules))
	}
}

func TestGetRoleDetail_ReturnsRole(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-role",
				Namespace: "default",
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{"pods"},
					Verbs:     []string{"get", "list"},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	role, err := app.GetRoleDetail("default", "my-role")
	if err != nil {
		t.Fatalf("GetRoleDetail failed: %v", err)
	}

	if role.Name != "my-role" {
		t.Errorf("expected role name 'my-role', got '%s'", role.Name)
	}
	if len(role.Rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(role.Rules))
	}
}

func TestGetRoleDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetRoleDetail("", "my-role")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetRoleDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetRoleDetail("default", "")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetClusterRoleDetail_ReturnsClusterRole(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{
				Name: "cluster-admin",
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{"*"},
					Resources: []string{"*"},
					Verbs:     []string{"*"},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	clusterRole, err := app.GetClusterRoleDetail("cluster-admin")
	if err != nil {
		t.Fatalf("GetClusterRoleDetail failed: %v", err)
	}

	if clusterRole.Name != "cluster-admin" {
		t.Errorf("expected cluster role name 'cluster-admin', got '%s'", clusterRole.Name)
	}
	if len(clusterRole.Rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(clusterRole.Rules))
	}
}

func TestGetClusterRoleDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetClusterRoleDetail("")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetRoles_RawFieldList(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset(
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "r1", Namespace: "default"}},
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "r2", Namespace: "default"}},
	)
	app := &App{ctx: ctx, testClientset: cs}
	list, err := app.GetRoles("default")
	if err != nil {
		t.Fatalf("GetRoles error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("want 2, got %d", len(list))
	}
	if list[0].Raw == nil {
		t.Fatal("expected Raw set for list item")
	}
	if _, ok := list[0].Raw.(*rbacv1.Role); !ok {
		t.Fatalf("Raw type = %T, want *rbacv1.Role", list[0].Raw)
	}
}

func TestGetClusterRoles_RawFieldList(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr1"}},
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr2"}},
	)
	app := &App{ctx: ctx, testClientset: cs}
	list, err := app.GetClusterRoles()
	if err != nil {
		t.Fatalf("GetClusterRoles error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("want 2, got %d", len(list))
	}
	if list[0].Raw == nil {
		t.Fatal("expected Raw set for cluster role list item")
	}
	if _, ok := list[0].Raw.(*rbacv1.ClusterRole); !ok {
		t.Fatalf("Raw type = %T, want *rbacv1.ClusterRole", list[0].Raw)
	}
}

func TestGetRoles_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoles("default")
	if err == nil {
		t.Error("expected error from GetRoles with no K8s context")
	}
}

func TestGetClusterRoles_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoles()
	if err == nil {
		t.Error("expected error from GetClusterRoles with no K8s context")
	}
}

func TestGetRoleDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoleDetail("default", "r")
	if err == nil {
		t.Error("expected error from GetRoleDetail with no K8s context")
	}
}

func TestGetClusterRoleDetail_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoleDetail("cr")
	if err == nil {
		t.Error("expected error from GetClusterRoleDetail with no K8s context")
	}
}
