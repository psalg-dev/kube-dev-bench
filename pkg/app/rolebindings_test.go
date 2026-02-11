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
					Kind:      "User",
					Name:      "john",
					APIGroup:  "rbac.authorization.k8s.io",
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

func TestGetRoleBindingDetail_ReturnsRoleBinding(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-rolebinding",
				Namespace: "default",
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "Role",
				Name:     "my-role",
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: []rbacv1.Subject{
				{
					Kind:      "ServiceAccount",
					Name:      "my-sa",
					Namespace: "default",
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	rb, err := app.GetRoleBindingDetail("default", "my-rolebinding")
	if err != nil {
		t.Fatalf("GetRoleBindingDetail failed: %v", err)
	}

	if rb.Name != "my-rolebinding" {
		t.Errorf("expected role binding name 'my-rolebinding', got '%s'", rb.Name)
	}
	if len(rb.Subjects) != 1 {
		t.Errorf("expected 1 subject, got %d", len(rb.Subjects))
	}
}

func TestGetRoleBindingDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetRoleBindingDetail("", "my-rolebinding")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetRoleBindingDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetRoleBindingDetail("default", "")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetClusterRoleBindingDetail_ReturnsClusterRoleBinding(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name: "cluster-admin-binding",
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
	)

	app := &App{ctx: ctx, testClientset: clientset}

	crb, err := app.GetClusterRoleBindingDetail("cluster-admin-binding")
	if err != nil {
		t.Fatalf("GetClusterRoleBindingDetail failed: %v", err)
	}

	if crb.Name != "cluster-admin-binding" {
		t.Errorf("expected cluster role binding name 'cluster-admin-binding', got '%s'", crb.Name)
	}
	if len(crb.Subjects) != 1 {
		t.Errorf("expected 1 subject, got %d", len(crb.Subjects))
	}
}

func TestGetClusterRoleBindingDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetClusterRoleBindingDetail("")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetRoleBindingSubjects(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	clientset := fake.NewSimpleClientset(
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "rb", Namespace: ns},
			RoleRef:    rbacv1.RoleRef{Kind: "Role", Name: "r", APIGroup: "rbac.authorization.k8s.io"},
			Subjects: []rbacv1.Subject{
				{Kind: "User", Name: "alice", APIGroup: "rbac.authorization.k8s.io"},
				{Kind: "Group", Name: "devs", APIGroup: "rbac.authorization.k8s.io"},
				{Kind: "ServiceAccount", Name: "sa", Namespace: ns},
			},
		},
	)
	app := &App{ctx: ctx, testClientset: clientset}
	subs, err := app.GetRoleBindingSubjects(ns, "rb")
	if err != nil {
		t.Fatalf("GetRoleBindingSubjects error: %v", err)
	}
	if len(subs) != 3 {
		t.Fatalf("want 3 subjects, got %d", len(subs))
	}
	// Verify order is preserved
	if subs[0].Name != "alice" || subs[1].Name != "devs" || subs[2].Name != "sa" {
		t.Fatalf("order not preserved: %+v", subs)
	}
}

func TestGetClusterRoleBindingSubjects(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "crb"},
			RoleRef:    rbacv1.RoleRef{Kind: "ClusterRole", Name: "cr", APIGroup: "rbac.authorization.k8s.io"},
			Subjects: []rbacv1.Subject{
				{Kind: "Group", Name: "system:masters", APIGroup: "rbac.authorization.k8s.io"},
				{Kind: "User", Name: "bob", APIGroup: "rbac.authorization.k8s.io"},
			},
		},
	)
	app := &App{ctx: ctx, testClientset: clientset}
	subs, err := app.GetClusterRoleBindingSubjects("crb")
	if err != nil {
		t.Fatalf("GetClusterRoleBindingSubjects error: %v", err)
	}
	if len(subs) != 2 {
		t.Fatalf("want 2 subjects, got %d", len(subs))
	}
	if subs[0].Name != "system:masters" || subs[1].Name != "bob" {
		t.Fatalf("order not preserved: %+v", subs)
	}
}

func TestGetRoleBindingSubjects_OrderAndFields(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	cs := fake.NewSimpleClientset(
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "rb-subjects", Namespace: ns},
			RoleRef:    rbacv1.RoleRef{Kind: "Role", Name: "r1", APIGroup: "rbac.authorization.k8s.io"},
			Subjects: []rbacv1.Subject{
				{Kind: "User", Name: "alice", APIGroup: "rbac.authorization.k8s.io"},
				{Kind: "ServiceAccount", Name: "sa1", Namespace: ns},
				{Kind: "Group", Name: "devs", APIGroup: "rbac.authorization.k8s.io"},
			},
		},
	)
	app := &App{ctx: ctx, testClientset: cs}
	subs, err := app.GetRoleBindingSubjects(ns, "rb-subjects")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(subs) != 3 {
		t.Fatalf("want 3, got %d", len(subs))
	}
	if subs[0].Name != "alice" || subs[1].Name != "sa1" || subs[2].Name != "devs" {
		t.Fatalf("order wrong: %+v", subs)
	}
	if subs[1].Kind != "ServiceAccount" || subs[1].Namespace != ns {
		t.Fatalf("serviceaccount fields: %+v", subs[1])
	}
}

func TestGetClusterRoleBindingSubjects_OrderAndFields(t *testing.T) {
	ctx := context.Background()
	cs := fake.NewSimpleClientset(
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "crb-subjects"},
			RoleRef:    rbacv1.RoleRef{Kind: "ClusterRole", Name: "cr1", APIGroup: "rbac.authorization.k8s.io"},
			Subjects: []rbacv1.Subject{
				{Kind: "Group", Name: "system:masters", APIGroup: "rbac.authorization.k8s.io"},
				{Kind: "User", Name: "bob", APIGroup: "rbac.authorization.k8s.io"},
			},
		},
	)
	app := &App{ctx: ctx, testClientset: cs}
	subs, err := app.GetClusterRoleBindingSubjects("crb-subjects")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(subs) != 2 {
		t.Fatalf("want 2, got %d", len(subs))
	}
	if subs[0].Kind != "Group" || subs[0].Name != "system:masters" {
		t.Fatalf("first wrong: %+v", subs[0])
	}
	if subs[1].Kind != "User" || subs[1].Name != "bob" {
		t.Fatalf("second wrong: %+v", subs[1])
	}
}

func TestGetRoleBindingSubjects_Validation(t *testing.T) {
	app := &App{ctx: context.Background()}
	if _, err := app.GetRoleBindingSubjects("", "name"); err == nil {
		t.Fatal("expected namespace error")
	}
	if _, err := app.GetRoleBindingSubjects("ns", ""); err == nil {
		t.Fatal("expected name error")
	}
}

func TestGetClusterRoleBindingSubjects_Validation(t *testing.T) {
	app := &App{ctx: context.Background()}
	if _, err := app.GetClusterRoleBindingSubjects(""); err == nil {
		t.Fatal("expected name error")
	}
}
