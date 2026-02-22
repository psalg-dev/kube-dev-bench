package app

import (
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── GetJobs informer path ────────────────────────────────────────────────────

func TestGetJobsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "batch-job", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Completions: int32Ptr(3),
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{Name: "worker", Image: "busybox:latest"},
					},
				},
			},
		},
		Status: batchv1.JobStatus{
			Succeeded: 2,
			Active:    1,
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetJobs("default")
	if err != nil {
		t.Fatalf("GetJobs() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 job, got %d", len(result))
	}
	if result[0].Name != "batch-job" {
		t.Errorf("expected job name 'batch-job', got %q", result[0].Name)
	}
	if result[0].Image != "busybox:latest" {
		t.Errorf("expected image 'busybox:latest', got %q", result[0].Image)
	}
}

// TestGetJobsUsesInformerCacheWithRunningJob tests the running job duration branch.
func TestGetJobsUsesInformerCacheWithRunningJob(t *testing.T) {
	now := metav1.Now()
	clientset := fake.NewSimpleClientset(&batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "running-job", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
				},
			},
		},
		Status: batchv1.JobStatus{
			StartTime: &now, // start time set, no completion time → "(running)" suffix
			Active:    1,
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetJobs("default")
	if err != nil {
		t.Fatalf("GetJobs() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 job, got %d", len(result))
	}
	if result[0].Name != "running-job" {
		t.Errorf("expected job name 'running-job', got %q", result[0].Name)
	}
}

// ─── GetRoles informer path ───────────────────────────────────────────────────

func TestGetRolesUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{Name: "pod-reader", Namespace: "default"},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{"get", "list", "watch"},
			},
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetRoles("default")
	if err != nil {
		t.Fatalf("GetRoles() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 role, got %d", len(result))
	}
	if result[0].Name != "pod-reader" {
		t.Errorf("expected role name 'pod-reader', got %q", result[0].Name)
	}
}

// ─── GetClusterRoles informer path ───────────────────────────────────────────

func TestGetClusterRolesUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&rbacv1.ClusterRole{
		ObjectMeta: metav1.ObjectMeta{Name: "cluster-admin-reader"},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"nodes"},
				Verbs:     []string{"get", "list"},
			},
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetClusterRoles()
	if err != nil {
		t.Fatalf("GetClusterRoles() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 cluster role, got %d", len(result))
	}
	if result[0].Name != "cluster-admin-reader" {
		t.Errorf("expected cluster role name 'cluster-admin-reader', got %q", result[0].Name)
	}
}

// ─── GetRoleBindings informer path ───────────────────────────────────────────

func TestGetRoleBindingsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: "dev-binding", Namespace: "default"},
		RoleRef: rbacv1.RoleRef{
			APIGroup: "rbac.authorization.k8s.io",
			Kind:     "Role",
			Name:     "pod-reader",
		},
		Subjects: []rbacv1.Subject{
			{Kind: "User", Name: "alice", APIGroup: "rbac.authorization.k8s.io"},
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetRoleBindings("default")
	if err != nil {
		t.Fatalf("GetRoleBindings() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 role binding, got %d", len(result))
	}
	if result[0].Name != "dev-binding" {
		t.Errorf("expected role binding name 'dev-binding', got %q", result[0].Name)
	}
}

// ─── GetClusterRoleBindings informer path ────────────────────────────────────

func TestGetClusterRoleBindingsUsesInformerCache(t *testing.T) {
	clientset := fake.NewSimpleClientset(&rbacv1.ClusterRoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: "full-admin-binding"},
		RoleRef: rbacv1.RoleRef{
			APIGroup: "rbac.authorization.k8s.io",
			Kind:     "ClusterRole",
			Name:     "cluster-admin",
		},
		Subjects: []rbacv1.Subject{
			{Kind: "ServiceAccount", Name: "admin-sa", Namespace: "kube-system"},
		},
	})
	app := newInformerApp(t, clientset, "default")
	result, err := app.GetClusterRoleBindings()
	if err != nil {
		t.Fatalf("GetClusterRoleBindings() error = %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 cluster role binding, got %d", len(result))
	}
	if result[0].Name != "full-admin-binding" {
		t.Errorf("expected cluster role binding 'full-admin-binding', got %q", result[0].Name)
	}
}
