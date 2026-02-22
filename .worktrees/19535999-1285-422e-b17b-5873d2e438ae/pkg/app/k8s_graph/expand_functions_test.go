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

// ---------------------------------------------------------------------------
// expandStatefulSet
// ---------------------------------------------------------------------------

func TestExpandStatefulSet_OwnsPodsAndMountsConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "db"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "db",
							EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "db-config"}}}},
						}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "db-config", Namespace: "default"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "db-0",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{{Kind: "StatefulSet", Name: "db"}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "db", Image: "postgres"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "statefulset", "db", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "statefulset", "default", "db")
	assertNode(t, graph, "pod", "default", "db-0")
	assertEdge(t, graph, "statefulset", "default", "db", "pod", "default", "db-0", EdgeTypeOwns)

	assertNode(t, graph, "configmap", "default", "db-config")
	assertEdge(t, graph, "statefulset", "default", "db", "configmap", "default", "db-config", EdgeTypeMounts)
}

func TestExpandStatefulSet_ServiceSelects(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "db"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "db", Image: "postgres"}}},
				},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "db-svc", Namespace: "default"},
			Spec:       corev1.ServiceSpec{Selector: map[string]string{"app": "db"}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "statefulset", "db", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "service", "default", "db-svc")
	assertEdge(t, graph, "service", "default", "db-svc", "statefulset", "default", "db", EdgeTypeSelects)
}

// ---------------------------------------------------------------------------
// expandDaemonSet
// ---------------------------------------------------------------------------

func TestExpandDaemonSet_OwnsPods(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "log-agent", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "log"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "agent", Image: "fluentd"}}},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "log-agent-node1",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{{Kind: "DaemonSet", Name: "log-agent"}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "agent", Image: "fluentd"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "daemonset", "log-agent", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "daemonset", "default", "log-agent")
	assertNode(t, graph, "pod", "default", "log-agent-node1")
	assertEdge(t, graph, "daemonset", "default", "log-agent", "pod", "default", "log-agent-node1", EdgeTypeOwns)
}

func TestExpandDaemonSet_MountsSecret(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "log-agent", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "log"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "agent",
							EnvFrom: []corev1.EnvFromSource{{SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "log-secret"}}}},
						}},
					},
				},
			},
		},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "log-secret", Namespace: "default"}},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "daemonset", "log-agent", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "secret", "default", "log-secret")
	assertEdge(t, graph, "daemonset", "default", "log-agent", "secret", "default", "log-secret", EdgeTypeMounts)
}

// ---------------------------------------------------------------------------
// expandJob
// ---------------------------------------------------------------------------

func TestExpandJob_OwnsPods(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "migration", Namespace: "default"},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "migrate", Image: "myapp"}}},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "migration-abc",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{{Kind: "Job", Name: "migration"}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "migrate", Image: "myapp"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "job", "migration", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "job", "default", "migration")
	assertNode(t, graph, "pod", "default", "migration-abc")
	assertEdge(t, graph, "job", "default", "migration", "pod", "default", "migration-abc", EdgeTypeOwns)
}

func TestExpandJob_OwnedByCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "nightly-backup", Namespace: "default"},
			Spec: batchv1.CronJobSpec{
				Schedule: "0 2 * * *",
				JobTemplate: batchv1.JobTemplateSpec{
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "backup", Image: "backup-tool"}}},
						},
					},
				},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "nightly-backup-28500000",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{{Kind: "CronJob", Name: "nightly-backup"}},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "backup", Image: "backup-tool"}}},
				},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "job", "nightly-backup-28500000", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "job", "default", "nightly-backup-28500000")
	assertNode(t, graph, "cronjob", "default", "nightly-backup")
	assertEdge(t, graph, "cronjob", "default", "nightly-backup", "job", "default", "nightly-backup-28500000", EdgeTypeOwns)
}

func TestExpandJob_MountsConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "import-job", Namespace: "default"},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "importer",
							EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "import-config"}}}},
						}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "import-config", Namespace: "default"}},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "job", "import-job", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "configmap", "default", "import-config")
	assertEdge(t, graph, "job", "default", "import-job", "configmap", "default", "import-config", EdgeTypeMounts)
}

// ---------------------------------------------------------------------------
// expandCronJob
// ---------------------------------------------------------------------------

func TestExpandCronJob_OwnsJobs(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "nightly", Namespace: "default"},
			Spec: batchv1.CronJobSpec{
				Schedule: "0 0 * * *",
				JobTemplate: batchv1.JobTemplateSpec{
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "worker", Image: "worker"}}},
						},
					},
				},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "nightly-12345",
				Namespace:       "default",
				OwnerReferences: []metav1.OwnerReference{{Kind: "CronJob", Name: "nightly"}},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "worker", Image: "worker"}}},
				},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "cronjob", "nightly", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "cronjob", "default", "nightly")
	assertNode(t, graph, "job", "default", "nightly-12345")
	assertEdge(t, graph, "cronjob", "default", "nightly", "job", "default", "nightly-12345", EdgeTypeOwns)
}

// ---------------------------------------------------------------------------
// expandClusterRoleBinding
// ---------------------------------------------------------------------------

func TestExpandClusterRoleBinding_BindsClusterRoleAndServiceAccount(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cluster-admin-lite"}},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "admin-sa", Namespace: "default"}},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "admin-binding"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "cluster-admin-lite"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "admin-sa", Namespace: "default"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("", "clusterrolebinding", "admin-binding", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "clusterrolebinding", "", "admin-binding")
	assertNode(t, graph, "clusterrole", "", "cluster-admin-lite")
	assertEdge(t, graph, "clusterrolebinding", "", "admin-binding", "clusterrole", "", "cluster-admin-lite", EdgeTypeBinds)

	assertNode(t, graph, "serviceaccount", "default", "admin-sa")
	assertEdge(t, graph, "clusterrolebinding", "", "admin-binding", "serviceaccount", "default", "admin-sa", EdgeTypeBinds)
}

// ---------------------------------------------------------------------------
// expandRoleBinding
// ---------------------------------------------------------------------------

func TestExpandRoleBinding_BindsRoleAndServiceAccount(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "pod-reader", Namespace: "default"}},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "reader-sa", Namespace: "default"}},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "reader-binding", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "pod-reader"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "reader-sa", Namespace: "default"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "rolebinding", "reader-binding", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "rolebinding", "default", "reader-binding")
	assertNode(t, graph, "role", "default", "pod-reader")
	assertEdge(t, graph, "rolebinding", "default", "reader-binding", "role", "default", "pod-reader", EdgeTypeBinds)

	assertNode(t, graph, "serviceaccount", "default", "reader-sa")
	assertEdge(t, graph, "rolebinding", "default", "reader-binding", "serviceaccount", "default", "reader-sa", EdgeTypeBinds)
}

// ---------------------------------------------------------------------------
// expandNode_k8s
// ---------------------------------------------------------------------------

func TestExpandNode_k8s_PodToNodeEdge(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "worker-1"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "app-pod", Namespace: "default"},
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
	assertNode(t, graph, "pod", "default", "app-pod")
	assertEdge(t, graph, "pod", "default", "app-pod", "node", "", "worker-1", EdgeTypeRunsOn)
}

// ---------------------------------------------------------------------------
// expandHPA and workloadKindForHPATarget
// ---------------------------------------------------------------------------

func TestExpandHPA_ScalesDeployment(t *testing.T) {
	minReplicas := int32(1)
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "api", Namespace: "default"},
			Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "api"}}},
		},
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "api-hpa", Namespace: "default"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
					Kind:       "Deployment",
					Name:       "api",
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
	assertNode(t, graph, "deployment", "default", "api")
	assertEdge(t, graph, "horizontalpodautoscaler", "default", "api-hpa", "deployment", "default", "api", EdgeTypeScales)
}

func TestExpandHPA_ScalesStatefulSet(t *testing.T) {
	minReplicas := int32(1)
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "cache", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "cache"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "cache", Image: "redis"}}},
				},
			},
		},
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "cache-hpa", Namespace: "default"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
					Kind:       "StatefulSet",
					Name:       "cache",
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

	assertNode(t, graph, "horizontalpodautoscaler", "default", "cache-hpa")
	assertNode(t, graph, "statefulset", "default", "cache")
	assertEdge(t, graph, "horizontalpodautoscaler", "default", "cache-hpa", "statefulset", "default", "cache", EdgeTypeScales)
}

func TestWorkloadKindForHPATarget(t *testing.T) {
	tests := []struct {
		kind     string
		expected string
	}{
		{"deployment", "Deployment"},
		{"Deployment", "Deployment"},
		{"statefulset", "StatefulSet"},
		{"StatefulSet", "StatefulSet"},
		{"daemonset", "DaemonSet"},
		{"replicaset", "ReplicaSet"},
		{"job", "Job"},
		{"cronjob", "CronJob"},
		{"unknown", ""},
		{"", ""},
	}

	for _, tc := range tests {
		got := workloadKindForHPATarget(tc.kind)
		if got != tc.expected {
			t.Errorf("workloadKindForHPATarget(%q) = %q, want %q", tc.kind, got, tc.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// expandNetworkPolicy
// ---------------------------------------------------------------------------

func TestExpandNetworkPolicy_TargetsPod(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "backend-pod",
				Namespace: "default",
				Labels:    map[string]string{"tier": "backend"},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "myapp"}}},
		},
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "backend-policy", Namespace: "default"},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{MatchLabels: map[string]string{"tier": "backend"}},
				PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "networkpolicy", "backend-policy", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "networkpolicy", "default", "backend-policy")
	assertNode(t, graph, "pod", "default", "backend-pod")
	assertEdge(t, graph, "networkpolicy", "default", "backend-policy", "pod", "default", "backend-pod", EdgeTypeNetworkPolicy)
}

// ---------------------------------------------------------------------------
// podSpecUsesPVC
// ---------------------------------------------------------------------------

func TestPodSpecUsesPVC_TrueForMatchingPVC(t *testing.T) {
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

	if !podSpecUsesPVC(spec, "my-pvc") {
		t.Error("expected podSpecUsesPVC to return true for matching PVC claim name")
	}
}

func TestPodSpecUsesPVC_FalseForEmptyDirOnly(t *testing.T) {
	spec := corev1.PodSpec{
		Volumes: []corev1.Volume{
			{
				Name:         "tmp",
				VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
			},
		},
		Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
	}

	if podSpecUsesPVC(spec, "my-pvc") {
		t.Error("expected podSpecUsesPVC to return false for emptyDir-only spec")
	}
}

func TestPodSpecUsesPVC_FalseForDifferentPVCName(t *testing.T) {
	spec := corev1.PodSpec{
		Volumes: []corev1.Volume{
			{
				Name: "data",
				VolumeSource: corev1.VolumeSource{
					PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
						ClaimName: "other-pvc",
					},
				},
			},
		},
		Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
	}

	if podSpecUsesPVC(spec, "my-pvc") {
		t.Error("expected podSpecUsesPVC to return false when PVC name does not match")
	}
}

func TestPodSpecUsesPVC_FalseForNoVolumes(t *testing.T) {
	spec := corev1.PodSpec{
		Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
	}

	if podSpecUsesPVC(spec, "my-pvc") {
		t.Error("expected podSpecUsesPVC to return false when no volumes are defined")
	}
}
