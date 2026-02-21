package k8s_graph

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// edgeCount returns the number of edges in the graph matching the given type.
func edgeCount(graph *ResourceGraph, edgeType EdgeType) int {
	count := 0
	for _, e := range graph.Edges {
		if e.Type == edgeType {
			count++
		}
	}
	return count
}

// TestExpandStatefulSet verifies that expanding a StatefulSet adds owned-pod and
// configmap-mount edges.
func TestExpandStatefulSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "web-sts", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "web"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "app",
							EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "web-cm"}}}},
						}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "web-cm", Namespace: "default"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "web-sts-0",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "StatefulSet",
					Name: "web-sts",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "statefulset", "web-sts", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "statefulset", "default", "web-sts")
	assertNode(t, graph, "pod", "default", "web-sts-0")
	assertNode(t, graph, "configmap", "default", "web-cm")
	assertEdge(t, graph, "statefulset", "default", "web-sts", "pod", "default", "web-sts-0", EdgeTypeOwns)
	assertEdge(t, graph, "statefulset", "default", "web-sts", "configmap", "default", "web-cm", EdgeTypeMounts)

	if edgeCount(graph, EdgeTypeOwns) < 1 {
		t.Fatal("expected at least one owns edge from StatefulSet")
	}
}

// TestExpandStatefulSetWithSecret verifies that secret refs in a StatefulSet pod template are
// added as mount edges.
func TestExpandStatefulSetWithSecret(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "db-sts", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "db"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "db",
							EnvFrom: []corev1.EnvFromSource{{SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "db-secret"}}}},
						}},
					},
				},
			},
		},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "db-secret", Namespace: "default"}},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "statefulset", "db-sts", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "statefulset", "default", "db-sts")
	assertNode(t, graph, "secret", "default", "db-secret")
	assertEdge(t, graph, "statefulset", "default", "db-sts", "secret", "default", "db-secret", EdgeTypeMounts)
}

// TestExpandDaemonSet verifies owned-pod and mount edges for a DaemonSet.
func TestExpandDaemonSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "log-ds", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "log"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "logger",
							EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "log-cm"}}}},
						}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "log-cm", Namespace: "default"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "log-ds-xyz",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "DaemonSet",
					Name: "log-ds",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "logger", Image: "fluentd"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "daemonset", "log-ds", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "daemonset", "default", "log-ds")
	assertNode(t, graph, "pod", "default", "log-ds-xyz")
	assertNode(t, graph, "configmap", "default", "log-cm")
	assertEdge(t, graph, "daemonset", "default", "log-ds", "pod", "default", "log-ds-xyz", EdgeTypeOwns)
	assertEdge(t, graph, "daemonset", "default", "log-ds", "configmap", "default", "log-cm", EdgeTypeMounts)

	if edgeCount(graph, EdgeTypeOwns) < 1 {
		t.Fatal("expected at least one owns edge from DaemonSet")
	}
}

// TestExpandDaemonSetWithSecret verifies secret refs from DaemonSet pod template.
func TestExpandDaemonSetWithSecret(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "mon-ds", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "mon"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "mon",
							EnvFrom: []corev1.EnvFromSource{{SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "mon-secret"}}}},
						}},
					},
				},
			},
		},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "mon-secret", Namespace: "default"}},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "daemonset", "mon-ds", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertEdge(t, graph, "daemonset", "default", "mon-ds", "secret", "default", "mon-secret", EdgeTypeMounts)
}

// TestExpandJob verifies that a Job with a CronJob owner adds an owns edge, and that
// owned pods are also linked.
func TestExpandJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "report-cj", Namespace: "default"},
			Spec: batchv1.CronJobSpec{
				Schedule:    "0 * * * *",
				JobTemplate: batchv1.JobTemplateSpec{},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "report-job",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "CronJob",
					Name: "report-cj",
				}},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{Name: "reporter", Image: "busybox"}},
					},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "report-pod",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "Job",
					Name: "report-job",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "reporter", Image: "busybox"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "job", "report-job", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "job", "default", "report-job")
	assertNode(t, graph, "cronjob", "default", "report-cj")
	assertNode(t, graph, "pod", "default", "report-pod")
	assertEdge(t, graph, "cronjob", "default", "report-cj", "job", "default", "report-job", EdgeTypeOwns)
	assertEdge(t, graph, "job", "default", "report-job", "pod", "default", "report-pod", EdgeTypeOwns)

	if edgeCount(graph, EdgeTypeOwns) < 1 {
		t.Fatal("expected at least one owns edge from Job")
	}
}

// TestExpandJobWithConfigMap verifies ConfigMap mount edges from a Job pod template.
func TestExpandJobWithConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "batch-job", Namespace: "default"},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "worker",
							EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "batch-cm"}}}},
						}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "batch-cm", Namespace: "default"}},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "job", "batch-job", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertEdge(t, graph, "job", "default", "batch-job", "configmap", "default", "batch-cm", EdgeTypeMounts)
}

// TestExpandCronJob verifies that a CronJob with owned Jobs adds owns edges.
func TestExpandCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "nightly-cj", Namespace: "default"},
			Spec: batchv1.CronJobSpec{
				Schedule:    "0 0 * * *",
				JobTemplate: batchv1.JobTemplateSpec{},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "nightly-job-1",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "CronJob",
					Name: "nightly-cj",
				}},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{Name: "worker", Image: "busybox"}},
					},
				},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "cronjob", "nightly-cj", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "cronjob", "default", "nightly-cj")
	assertNode(t, graph, "job", "default", "nightly-job-1")
	assertEdge(t, graph, "cronjob", "default", "nightly-cj", "job", "default", "nightly-job-1", EdgeTypeOwns)

	if edgeCount(graph, EdgeTypeOwns) < 1 {
		t.Fatal("expected at least one owns edge from CronJob")
	}
}

// TestExpandClusterRoleBinding verifies that a ClusterRoleBinding adds binds edges to its
// ClusterRole and ServiceAccount subjects.
func TestExpandClusterRoleBinding(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{Name: "cluster-viewer"},
		},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "viewer-sa", Namespace: "default"}},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "viewer-crb"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "cluster-viewer"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "viewer-sa", Namespace: "default"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("", "clusterrolebinding", "viewer-crb", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "clusterrolebinding", "", "viewer-crb")
	assertNode(t, graph, "clusterrole", "", "cluster-viewer")
	assertNode(t, graph, "serviceaccount", "default", "viewer-sa")
	assertEdge(t, graph, "clusterrolebinding", "", "viewer-crb", "clusterrole", "", "cluster-viewer", EdgeTypeBinds)
	assertEdge(t, graph, "clusterrolebinding", "", "viewer-crb", "serviceaccount", "default", "viewer-sa", EdgeTypeBinds)

	if edgeCount(graph, EdgeTypeBinds) < 1 {
		t.Fatal("expected at least one binds edge from ClusterRoleBinding")
	}
}

// TestExpandRoleBindingWithClusterRoleRef verifies that a RoleBinding referencing a ClusterRole
// adds the correct binds edge.
func TestExpandRoleBindingWithClusterRoleRef(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{Name: "global-reader"},
		},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "reader-sa", Namespace: "default"}},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "reader-rb", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "global-reader"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "reader-sa", Namespace: "default"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "rolebinding", "reader-rb", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "rolebinding", "default", "reader-rb")
	assertNode(t, graph, "clusterrole", "default", "global-reader")
	assertEdge(t, graph, "rolebinding", "default", "reader-rb", "clusterrole", "default", "global-reader", EdgeTypeBinds)

	if edgeCount(graph, EdgeTypeBinds) < 1 {
		t.Fatal("expected at least one binds edge from RoleBinding")
	}
}

// TestExpandRole verifies that expanding a Role adds binds edges from RoleBindings
// that reference it.
func TestExpandRole(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-reader", Namespace: "default"},
			Rules: []rbacv1.PolicyRule{{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{"get", "list"},
			}},
		},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-reader-rb", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "pod-reader"},
			Subjects:   []rbacv1.Subject{{Kind: "ServiceAccount", Name: "reader-sa", Namespace: "default"}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "role", "pod-reader", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "role", "default", "pod-reader")
	assertNode(t, graph, "rolebinding", "default", "pod-reader-rb")
	assertEdge(t, graph, "rolebinding", "default", "pod-reader-rb", "role", "default", "pod-reader", EdgeTypeBinds)

	if edgeCount(graph, EdgeTypeBinds) < 1 {
		t.Fatal("expected at least one binds edge from Role")
	}
}

// TestExpandClusterRole verifies that expanding a ClusterRole adds binds edges from
// ClusterRoleBindings that reference it.
func TestExpandClusterRole(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{Name: "node-reader"},
			Rules: []rbacv1.PolicyRule{{
				APIGroups: []string{""},
				Resources: []string{"nodes"},
				Verbs:     []string{"get", "list"},
			}},
		},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "node-reader-crb"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "node-reader"},
			Subjects:   []rbacv1.Subject{{Kind: "ServiceAccount", Name: "ops-sa", Namespace: "default"}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("", "clusterrole", "node-reader", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "clusterrole", "", "node-reader")
	assertNode(t, graph, "clusterrolebinding", "", "node-reader-crb")
	assertEdge(t, graph, "clusterrolebinding", "", "node-reader-crb", "clusterrole", "", "node-reader", EdgeTypeBinds)

	if edgeCount(graph, EdgeTypeBinds) < 1 {
		t.Fatal("expected at least one binds edge from ClusterRole")
	}
}

// TestExpandNode_k8s verifies that expanding a Kubernetes Node returns pods running on it.
// The fake client ignores field selectors, but a single pod in the fake store is still returned
// and linked with a runs_on edge.
func TestExpandNode_k8s(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "worker-1"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "worker-pod", Namespace: "default"},
			Spec: corev1.PodSpec{
				NodeName:   "worker-1",
				Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("", "node", "worker-1", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "node", "", "worker-1")
	// The fake client returns all pods regardless of the field selector, so the pod
	// should appear in the graph regardless.
	assertNode(t, graph, "pod", "default", "worker-pod")
	assertEdge(t, graph, "pod", "default", "worker-pod", "node", "", "worker-1", EdgeTypeRunsOn)

	if edgeCount(graph, EdgeTypeRunsOn) < 1 {
		t.Fatal("expected at least one runs_on edge from Node")
	}
}

// TestExpandHPA verifies that an HPA adds a scales edge to its target workload, and that
// workloadKindForHPATarget returns the correct canonical kind string.
func TestExpandHPA(t *testing.T) {
	// --- workloadKindForHPATarget unit tests (AC#4) ---
	kindTests := []struct {
		input string
		want  string
	}{
		{"deployment", "Deployment"},
		{"statefulset", "StatefulSet"},
		{"replicaset", "ReplicaSet"},
		{"daemonset", "DaemonSet"},
		{"job", "Job"},
		{"cronjob", "CronJob"},
		{"unknown", ""},
		{"", ""},
	}
	for _, tt := range kindTests {
		got := workloadKindForHPATarget(tt.input)
		if got != tt.want {
			t.Errorf("workloadKindForHPATarget(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}

	// --- expandHPA integration: HPA targeting a Deployment ---
	t.Run("HPA_scales_Deployment", func(t *testing.T) {
		minReplicas := int32(2)
		clientset := fake.NewSimpleClientset(
			&appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{Name: "api-deploy", Namespace: "default"},
				Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "api"}}},
			},
			&autoscalingv2.HorizontalPodAutoscaler{
				ObjectMeta: metav1.ObjectMeta{Name: "api-hpa", Namespace: "default"},
				Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
					ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
						Kind:       "Deployment",
						Name:       "api-deploy",
						APIVersion: "apps/v1",
					},
					MinReplicas: &minReplicas,
					MaxReplicas: 10,
				},
			},
		)
		builder := NewBuilder(context.Background(), clientset)
		graph, err := builder.BuildForResource("default", "horizontalpodautoscaler", "api-hpa", 1)
		if err != nil {
			t.Fatalf("BuildForResource error: %v", err)
		}
		assertNode(t, graph, "horizontalpodautoscaler", "default", "api-hpa")
		assertNode(t, graph, "deployment", "default", "api-deploy")
		assertEdge(t, graph, "horizontalpodautoscaler", "default", "api-hpa", "deployment", "default", "api-deploy", EdgeTypeScales)
		if edgeCount(graph, EdgeTypeScales) < 1 {
			t.Fatal("expected at least one scales edge from HPA")
		}
	})

	// --- expandHPA integration: HPA targeting a StatefulSet (AC#4) ---
	t.Run("HPA_scales_StatefulSet", func(t *testing.T) {
		minReplicas := int32(1)
		clientset := fake.NewSimpleClientset(
			&appsv1.StatefulSet{
				ObjectMeta: metav1.ObjectMeta{Name: "cache-sts", Namespace: "default"},
				Spec:       appsv1.StatefulSetSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "cache"}}},
			},
			&autoscalingv2.HorizontalPodAutoscaler{
				ObjectMeta: metav1.ObjectMeta{Name: "cache-hpa", Namespace: "default"},
				Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
					ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
						Kind:       "StatefulSet",
						Name:       "cache-sts",
						APIVersion: "apps/v1",
					},
					MinReplicas: &minReplicas,
					MaxReplicas: 5,
				},
			},
		)
		builder := NewBuilder(context.Background(), clientset)
		graph, err := builder.BuildForResource("default", "horizontalpodautoscaler", "cache-hpa", 1)
		if err != nil {
			t.Fatalf("BuildForResource error: %v", err)
		}
		assertNode(t, graph, "statefulset", "default", "cache-sts")
		assertEdge(t, graph, "horizontalpodautoscaler", "default", "cache-hpa", "statefulset", "default", "cache-sts", EdgeTypeScales)
	})

	// --- expandHPA integration: HPA targeting a ReplicaSet (AC#4) ---
	t.Run("HPA_scales_ReplicaSet", func(t *testing.T) {
		minReplicas := int32(1)
		clientset := fake.NewSimpleClientset(
			&appsv1.ReplicaSet{
				ObjectMeta: metav1.ObjectMeta{Name: "srv-rs", Namespace: "default"},
				Spec:       appsv1.ReplicaSetSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "srv"}}},
			},
			&autoscalingv2.HorizontalPodAutoscaler{
				ObjectMeta: metav1.ObjectMeta{Name: "srv-hpa", Namespace: "default"},
				Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
					ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
						Kind:       "ReplicaSet",
						Name:       "srv-rs",
						APIVersion: "apps/v1",
					},
					MinReplicas: &minReplicas,
					MaxReplicas: 8,
				},
			},
		)
		builder := NewBuilder(context.Background(), clientset)
		graph, err := builder.BuildForResource("default", "horizontalpodautoscaler", "srv-hpa", 1)
		if err != nil {
			t.Fatalf("BuildForResource error: %v", err)
		}
		assertNode(t, graph, "replicaset", "default", "srv-rs")
		assertEdge(t, graph, "horizontalpodautoscaler", "default", "srv-hpa", "replicaset", "default", "srv-rs", EdgeTypeScales)
	})
}

// TestExpandNetworkPolicy verifies that a NetworkPolicy with a pod selector adds
// network_policy edges to matching pods.
func TestExpandNetworkPolicy(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "allow-api", Namespace: "default"},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{MatchLabels: map[string]string{"app": "api"}},
				PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "api-pod",
				Namespace: "default",
				Labels:    map[string]string{"app": "api"},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "api", Image: "nginx"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "networkpolicy", "allow-api", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "networkpolicy", "default", "allow-api")
	assertNode(t, graph, "pod", "default", "api-pod")
	assertEdge(t, graph, "networkpolicy", "default", "allow-api", "pod", "default", "api-pod", EdgeTypeNetworkPolicy)

	if edgeCount(graph, EdgeTypeNetworkPolicy) < 1 {
		t.Fatal("expected at least one network_policy edge from NetworkPolicy")
	}
}

// TestExpandNetworkPolicyNoSelector verifies that a NetworkPolicy with an empty pod selector
// does not panic and returns an empty neighbors list (no label-based match).
func TestExpandNetworkPolicyNoSelector(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "allow-all", Namespace: "default"},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{}, // empty → match all
				PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	// Should not error; empty pod selector means no label-based edges are added
	graph, err := builder.BuildForResource("default", "networkpolicy", "allow-all", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}
	assertNode(t, graph, "networkpolicy", "default", "allow-all")
}

// TestPodSpecUsesPVC covers both a matching and a non-matching PVC claim name (AC#5).
func TestPodSpecUsesPVC(t *testing.T) {
	spec := corev1.PodSpec{
		Volumes: []corev1.Volume{
			{
				Name: "data",
				VolumeSource: corev1.VolumeSource{
					PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
						ClaimName: "my-pvc",
					},
				},
			},
		},
		Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
	}

	t.Run("matching_claim_name", func(t *testing.T) {
		if !podSpecUsesPVC(spec, "my-pvc") {
			t.Fatal("expected podSpecUsesPVC to return true for matching claim name")
		}
	})

	t.Run("non_matching_claim_name", func(t *testing.T) {
		if podSpecUsesPVC(spec, "other-pvc") {
			t.Fatal("expected podSpecUsesPVC to return false for non-matching claim name")
		}
	})

	t.Run("no_volumes", func(t *testing.T) {
		empty := corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}}
		if podSpecUsesPVC(empty, "my-pvc") {
			t.Fatal("expected podSpecUsesPVC to return false when no volumes are present")
		}
	})
}

// TestExpandStatefulSetWithHPA verifies that an HPA targeting a StatefulSet produces a
// scales edge when expanding the StatefulSet.
func TestExpandStatefulSetWithHPA(t *testing.T) {
	minReplicas := int32(1)
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "data-sts", Namespace: "default"},
			Spec:       appsv1.StatefulSetSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "data"}}},
		},
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "data-hpa", Namespace: "default"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
					Kind:       "StatefulSet",
					Name:       "data-sts",
					APIVersion: "apps/v1",
				},
				MinReplicas: &minReplicas,
				MaxReplicas: 5,
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "statefulset", "data-sts", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "horizontalpodautoscaler", "default", "data-hpa")
	assertEdge(t, graph, "horizontalpodautoscaler", "default", "data-hpa", "statefulset", "default", "data-sts", EdgeTypeScales)
}

// TestExpandDaemonSetWithService verifies that a service selecting DaemonSet pods
// produces a selects edge when expanding the DaemonSet.
func TestExpandDaemonSetWithService(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "proxy-ds", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "proxy"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "proxy", Image: "envoy"}}},
				},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "proxy-svc", Namespace: "default"},
			Spec: corev1.ServiceSpec{
				Selector: map[string]string{"app": "proxy"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "daemonset", "proxy-ds", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "service", "default", "proxy-svc")
	assertEdge(t, graph, "service", "default", "proxy-svc", "daemonset", "default", "proxy-ds", EdgeTypeSelects)
}

// TestExpandStatefulSetWithService verifies that a service selecting StatefulSet pods
// produces a selects edge when expanding the StatefulSet.
func TestExpandStatefulSetWithService(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "kafka-sts", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "kafka"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "kafka", Image: "kafka"}}},
				},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "kafka-svc", Namespace: "default"},
			Spec: corev1.ServiceSpec{
				Selector: map[string]string{"app": "kafka"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "statefulset", "kafka-sts", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "service", "default", "kafka-svc")
	assertEdge(t, graph, "service", "default", "kafka-svc", "statefulset", "default", "kafka-sts", EdgeTypeSelects)
}
