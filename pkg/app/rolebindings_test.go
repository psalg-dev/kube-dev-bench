package app

import (
	"context"
	"testing"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetRoleBindings_ReturnsRoleBindings(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-rolebinding",
				Namespace: "default",
				Labels: map[string]string{
					"app": "myapp",
				},
				Annotations: map[string]string{
					"description": "test role binding",
				},
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "Role",
				Name:     "my-role",
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: []rbacv1.Subject{
				{
					Kind:     "User",
					Name:     "john",
					APIGroup: "rbac.authorization.k8s.io",
				},
				{
					Kind:      "ServiceAccount",
					Name:      "my-sa",
					Namespace: "default",
				},
			},
		},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "another-rolebinding",
				Namespace: "default",
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "Role",
				Name:     "another-role",
				APIGroup: "rbac.authorization.k8s.io",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	roleBindings, err := app.GetRoleBindings("default")
	if err != nil {
		t.Fatalf("GetRoleBindings failed: %v", err)
	}

	if len(roleBindings) != 2 {
		t.Fatalf("expected 2 role bindings, got %d", len(roleBindings))
	}

	// Find the role binding by name
	var myRoleBinding *RoleBindingInfo
	for i := range roleBindings {
		if roleBindings[i].Name == "my-rolebinding" {
			myRoleBinding = &roleBindings[i]
			break
		}
	}

	if myRoleBinding == nil {
		t.Fatal("expected to find role binding 'my-rolebinding'")
	}

	// Verify role binding details
	if myRoleBinding.Namespace != "default" {
		t.Errorf("expected namespace 'default', got '%s'", myRoleBinding.Namespace)
	}
	if myRoleBinding.RoleRef.Name != "my-role" {
		t.Errorf("expected role ref name 'my-role', got '%s'", myRoleBinding.RoleRef.Name)
	}
	if len(myRoleBinding.Subjects) != 2 {
		t.Errorf("expected 2 subjects, got %d", len(myRoleBinding.Subjects))
	}
}

func TestGetRoleBindings_NoRoleBindings(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	roleBindings, err := app.GetRoleBindings("default")
	if err != nil {
		t.Fatalf("GetRoleBindings failed: %v", err)
	}

	if len(roleBindings) != 0 {
		t.Errorf("expected 0 role bindings, got %d", len(roleBindings))
	}
}

func TestGetRoleBindings_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetRoleBindings("")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetClusterRoleBindings_ReturnsClusterRoleBindings(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name: "cluster-admin-binding",
				Labels: map[string]string{
					"kubernetes.io/bootstrapping": "rbac-defaults",
				},
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "ClusterRole",
				Name:     "cluster-admin",
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: []rbacv1.Subject{
				{
					Kind:     "Group",
					Name:     "system:masters",
					APIGroup: "rbac.authorization.k8s.io",
				},
			},
		},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name: "view-binding",
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "ClusterRole",
				Name:     "view",
				APIGroup: "rbac.authorization.k8s.io",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	clusterRoleBindings, err := app.GetClusterRoleBindings()
	if err != nil {
		t.Fatalf("GetClusterRoleBindings failed: %v", err)
	}

	if len(clusterRoleBindings) != 2 {
		t.Fatalf("expected 2 cluster role bindings, got %d", len(clusterRoleBindings))
	}

	// Verify first cluster role binding details
	if clusterRoleBindings[0].Name != "cluster-admin-binding" {
		t.Errorf("expected cluster role binding name 'cluster-admin-binding', got '%s'", clusterRoleBindings[0].Name)
	}
	if clusterRoleBindings[0].Namespace != "" {
		t.Errorf("expected empty namespace for cluster role binding, got '%s'", clusterRoleBindings[0].Namespace)
	}
	if len(clusterRoleBindings[0].Subjects) != 1 {
		t.Errorf("expected 1 subject, got %d", len(clusterRoleBindings[0].Subjects))
	}
}

// Verify order is preserved

func TestGetRoleBindings_RawFieldList(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset(
		&rbacv1.RoleBinding{ObjectMeta: metav1.ObjectMeta{Name: "rb1", Namespace: "default"}, RoleRef: rbacv1.RoleRef{Kind: "Role", Name: "r1", APIGroup: "rbac.authorization.k8s.io"}},
		&rbacv1.RoleBinding{ObjectMeta: metav1.ObjectMeta{Name: "rb2", Namespace: "default"}, RoleRef: rbacv1.RoleRef{Kind: "Role", Name: "r2", APIGroup: "rbac.authorization.k8s.io"}},
	)
	app := &App{ctx: ctx, testClientset: cs}
	list, err := app.GetRoleBindings("default")
	if err != nil {
		t.Fatalf("GetRoleBindings error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("want 2, got %d", len(list))
	}
	if list[0].Raw == nil {
		t.Fatal("expected Raw set")
	}
	if _, ok := list[0].Raw.(*rbacv1.RoleBinding); !ok {
		t.Fatalf("Raw type = %T, want *rbacv1.RoleBinding", list[0].Raw)
	}
}

func TestGetClusterRoleBindings_RawFieldList(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset(
		&rbacv1.ClusterRoleBinding{ObjectMeta: metav1.ObjectMeta{Name: "crb1"}, RoleRef: rbacv1.RoleRef{Kind: "ClusterRole", Name: "cr1", APIGroup: "rbac.authorization.k8s.io"}},
		&rbacv1.ClusterRoleBinding{ObjectMeta: metav1.ObjectMeta{Name: "crb2"}, RoleRef: rbacv1.RoleRef{Kind: "ClusterRole", Name: "cr2", APIGroup: "rbac.authorization.k8s.io"}},
	)
	app := &App{ctx: ctx, testClientset: cs}
	list, err := app.GetClusterRoleBindings()
	if err != nil {
		t.Fatalf("GetClusterRoleBindings error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("want 2, got %d", len(list))
	}
	if list[0].Raw == nil {
		t.Fatal("expected Raw set")
	}
	if _, ok := list[0].Raw.(*rbacv1.ClusterRoleBinding); !ok {
		t.Fatalf("Raw type = %T, want *rbacv1.ClusterRoleBinding", list[0].Raw)
	}
}

func TestGetRoleBindings_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetRoleBindings("default")
	if err == nil {
		t.Error("expected error from GetRoleBindings with no K8s context")
	}
}

func TestGetClusterRoleBindings_GetK8sError(t *testing.T) {
	app := newAppNoCtx()
	_, err := app.GetClusterRoleBindings()
	if err == nil {
		t.Error("expected error from GetClusterRoleBindings with no K8s context")
	}
}
