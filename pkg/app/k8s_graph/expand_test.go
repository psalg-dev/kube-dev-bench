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

// ---- expandStatefulSet ----

func TestExpandStatefulSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "sts-1", Namespace: "ns"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "sts-1"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
					},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sts-1-0",
				Namespace: "ns",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "StatefulSet",
					Name: "sts-1",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "statefulset", "sts-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "statefulset", "ns", "sts-1")
	assertNode(t, graph, "pod", "ns", "sts-1-0")
	assertEdge(t, graph, "statefulset", "ns", "sts-1", "pod", "ns", "sts-1-0", EdgeTypeOwns)
}

func TestExpandStatefulSetMountsConfigMapAndSecret(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "sts-cm", Namespace: "ns"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "sts-cm"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Volumes: []corev1.Volume{
							{Name: "cfg", VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "sts-cm-map"}}}},
							{Name: "sec", VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: "sts-secret"}}},
						},
						Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "sts-cm-map", Namespace: "ns"}},
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "sts-secret", Namespace: "ns"}},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "statefulset", "sts-cm", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertEdge(t, graph, "statefulset", "ns", "sts-cm", "configmap", "ns", "sts-cm-map", EdgeTypeMounts)
	assertEdge(t, graph, "statefulset", "ns", "sts-cm", "secret", "ns", "sts-secret", EdgeTypeMounts)
}

// ---- expandDaemonSet ----

func TestExpandDaemonSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "ds-1", Namespace: "ns"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds-1"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ds-1-pod",
				Namespace: "ns",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "DaemonSet",
					Name: "ds-1",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "daemonset", "ds-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "daemonset", "ns", "ds-1")
	assertNode(t, graph, "pod", "ns", "ds-1-pod")
	assertEdge(t, graph, "daemonset", "ns", "ds-1", "pod", "ns", "ds-1-pod", EdgeTypeOwns)
}

func TestExpandDaemonSetMountsConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "ds-cfg", Namespace: "ns"},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds-cfg"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Volumes: []corev1.Volume{{
							Name:         "cfg",
							VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "ds-map"}}},
						}},
						Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "ds-map", Namespace: "ns"}},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "daemonset", "ds-cfg", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertEdge(t, graph, "daemonset", "ns", "ds-cfg", "configmap", "ns", "ds-map", EdgeTypeMounts)
}

// ---- expandJob ----

func TestExpandJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "job-1", Namespace: "ns"},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "job-1-pod",
				Namespace: "ns",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "Job",
					Name: "job-1",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "job", "job-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "job", "ns", "job-1")
	assertNode(t, graph, "pod", "ns", "job-1-pod")
	assertEdge(t, graph, "job", "ns", "job-1", "pod", "ns", "job-1-pod", EdgeTypeOwns)
}

func TestExpandJobOwnedByCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "cj-job",
				Namespace: "ns",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "CronJob",
					Name: "my-cron",
				}},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
				},
			},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "job", "cj-job", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "job", "ns", "cj-job")
	assertNode(t, graph, "cronjob", "ns", "my-cron")
	assertEdge(t, graph, "cronjob", "ns", "my-cron", "job", "ns", "cj-job", EdgeTypeOwns)
}

func TestExpandJobMountsConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "job-cm", Namespace: "ns"},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Volumes: []corev1.Volume{{
							Name:         "cfg",
							VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "job-map"}}},
						}},
						Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
					},
				},
			},
		},
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "job-map", Namespace: "ns"}},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "job", "job-cm", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertEdge(t, graph, "job", "ns", "job-cm", "configmap", "ns", "job-map", EdgeTypeMounts)
}

// ---- expandCronJob ----

func TestExpandCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "cron-1", Namespace: "ns"},
			Spec: batchv1.CronJobSpec{
				Schedule: "*/5 * * * *",
				JobTemplate: batchv1.JobTemplateSpec{
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
						},
					},
				},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "cron-1-job",
				Namespace: "ns",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "CronJob",
					Name: "cron-1",
				}},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
				},
			},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "cronjob", "cron-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "cronjob", "ns", "cron-1")
	assertNode(t, graph, "job", "ns", "cron-1-job")
	assertEdge(t, graph, "cronjob", "ns", "cron-1", "job", "ns", "cron-1-job", EdgeTypeOwns)
}

// ---- expandClusterRoleBinding ----

func TestExpandClusterRoleBinding(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "crb-1"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "cr-1"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "sa-1", Namespace: "ns"},
			},
		},
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr-1"}},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "sa-1", Namespace: "ns"}},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("", "clusterrolebinding", "crb-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "clusterrolebinding", "", "crb-1")
	assertNode(t, graph, "clusterrole", "", "cr-1")
	assertNode(t, graph, "serviceaccount", "ns", "sa-1")
	assertEdge(t, graph, "clusterrolebinding", "", "crb-1", "clusterrole", "", "cr-1", EdgeTypeBinds)
	assertEdge(t, graph, "clusterrolebinding", "", "crb-1", "serviceaccount", "ns", "sa-1", EdgeTypeBinds)
}

// ---- expandRoleBinding ----

func TestExpandRoleBinding(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "rb-1", Namespace: "ns"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "role-1"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "sa-rb", Namespace: "ns"},
			},
		},
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "role-1", Namespace: "ns"}},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "sa-rb", Namespace: "ns"}},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "rolebinding", "rb-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "rolebinding", "ns", "rb-1")
	assertNode(t, graph, "role", "ns", "role-1")
	assertNode(t, graph, "serviceaccount", "ns", "sa-rb")
	assertEdge(t, graph, "rolebinding", "ns", "rb-1", "role", "ns", "role-1", EdgeTypeBinds)
	assertEdge(t, graph, "rolebinding", "ns", "rb-1", "serviceaccount", "ns", "sa-rb", EdgeTypeBinds)
}

// ---- expandRole ----

func TestExpandRole(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "role-x", Namespace: "ns"}},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "rb-for-role-x", Namespace: "ns"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "role-x"},
			Subjects:   []rbacv1.Subject{{Kind: "ServiceAccount", Name: "sa-x", Namespace: "ns"}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "role", "role-x", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "role", "ns", "role-x")
	assertNode(t, graph, "rolebinding", "ns", "rb-for-role-x")
	assertEdge(t, graph, "rolebinding", "ns", "rb-for-role-x", "role", "ns", "role-x", EdgeTypeBinds)
}

// ---- expandClusterRole ----

func TestExpandClusterRole(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "cr-x"}},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "crb-for-cr-x"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "cr-x"},
			Subjects:   []rbacv1.Subject{{Kind: "ServiceAccount", Name: "sa-x", Namespace: "ns"}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("", "clusterrole", "cr-x", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "clusterrole", "", "cr-x")
	assertNode(t, graph, "clusterrolebinding", "", "crb-for-cr-x")
	assertEdge(t, graph, "clusterrolebinding", "", "crb-for-cr-x", "clusterrole", "", "cr-x", EdgeTypeBinds)
}

// ---- expandNode_k8s ----

func TestExpandNode_k8s(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "worker-1"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-on-worker", Namespace: "ns"},
			Spec: corev1.PodSpec{
				NodeName:   "worker-1",
				Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
			},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	// expandNode_k8s is triggered via BuildForResource with kind "node"
	graph, err := b.BuildForResource("", "node", "worker-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "node", "", "worker-1")
	assertNode(t, graph, "pod", "ns", "pod-on-worker")
	assertEdge(t, graph, "pod", "ns", "pod-on-worker", "node", "", "worker-1", EdgeTypeRunsOn)
}

// ---- expandHPA ----

func TestExpandHPA(t *testing.T) {
	minReplicas := int32(1)
	clientset := fake.NewSimpleClientset(
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "hpa-1", Namespace: "ns"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
					Kind:       "Deployment",
					Name:       "deploy-target",
					APIVersion: "apps/v1",
				},
				MinReplicas: &minReplicas,
				MaxReplicas: 5,
			},
		},
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "deploy-target", Namespace: "ns"},
			Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "x"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "horizontalpodautoscaler", "hpa-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "horizontalpodautoscaler", "ns", "hpa-1")
	assertNode(t, graph, "deployment", "ns", "deploy-target")
	assertEdge(t, graph, "horizontalpodautoscaler", "ns", "hpa-1", "deployment", "ns", "deploy-target", EdgeTypeScales)
}

func TestExpandHPATargetsStatefulSet(t *testing.T) {
	minReplicas := int32(1)
	clientset := fake.NewSimpleClientset(
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "hpa-sts", Namespace: "ns"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{
					Kind:       "StatefulSet",
					Name:       "sts-target",
					APIVersion: "apps/v1",
				},
				MinReplicas: &minReplicas,
				MaxReplicas: 3,
			},
		},
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "sts-target", Namespace: "ns"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "y"}},
				Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}}},
			},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "horizontalpodautoscaler", "hpa-sts", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "horizontalpodautoscaler", "ns", "hpa-sts")
	assertNode(t, graph, "statefulset", "ns", "sts-target")
	assertEdge(t, graph, "horizontalpodautoscaler", "ns", "hpa-sts", "statefulset", "ns", "sts-target", EdgeTypeScales)
}

func TestWorkloadKindForHPATarget(t *testing.T) {
	tests := []struct {
		kind string
		want string
	}{
		{"deployment", "Deployment"},
		{"Deployment", "Deployment"},
		{"statefulset", "StatefulSet"},
		{"StatefulSet", "StatefulSet"},
		{"replicaset", "ReplicaSet"},
		{"ReplicaSet", "ReplicaSet"},
		{"daemonset", "DaemonSet"},
		{"job", "Job"},
		{"cronjob", "CronJob"},
		{"unknown", ""},
		{"", ""},
	}

	for _, tc := range tests {
		got := workloadKindForHPATarget(tc.kind)
		if got != tc.want {
			t.Errorf("workloadKindForHPATarget(%q) = %q, want %q", tc.kind, got, tc.want)
		}
	}
}

// ---- expandNetworkPolicy ----

func TestExpandNetworkPolicy(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "np-1", Namespace: "ns"},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "api"},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "api-pod",
				Namespace: "ns",
				Labels:    map[string]string{"app": "api"},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "networkpolicy", "np-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "networkpolicy", "ns", "np-1")
	assertNode(t, graph, "pod", "ns", "api-pod")
	assertEdge(t, graph, "networkpolicy", "ns", "np-1", "pod", "ns", "api-pod", EdgeTypeNetworkPolicy)
}

func TestExpandNetworkPolicyNoMatchLabels(t *testing.T) {
	// A NetworkPolicy with empty podSelector matches all pods but expandNetworkPolicy
	// only queries when len(MatchLabels) > 0, so no edge should be added.
	clientset := fake.NewSimpleClientset(
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "np-empty", Namespace: "ns"},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "any-pod", Namespace: "ns"},
			Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "networkpolicy", "np-empty", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertNode(t, graph, "networkpolicy", "ns", "np-empty")
	// No network_policy edge should be created since MatchLabels is empty
	for _, edge := range graph.Edges {
		if edge.Type == EdgeTypeNetworkPolicy {
			t.Fatalf("unexpected network_policy edge: %+v", edge)
		}
	}
}

// ---- podSpecUsesPVC ----

func TestPodSpecUsesPVC(t *testing.T) {
	t.Run("matching_claim_name", func(t *testing.T) {
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
		}
		if !podSpecUsesPVC(spec, "my-pvc") {
			t.Error("expected podSpecUsesPVC to return true for matching claim name")
		}
	})

	t.Run("non_matching_claim_name", func(t *testing.T) {
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
		}
		if podSpecUsesPVC(spec, "my-pvc") {
			t.Error("expected podSpecUsesPVC to return false for non-matching claim name")
		}
	})

	t.Run("no_pvc_volume", func(t *testing.T) {
		spec := corev1.PodSpec{
			Volumes: []corev1.Volume{
				{
					Name:         "cfg",
					VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "some-cm"}}},
				},
			},
		}
		if podSpecUsesPVC(spec, "my-pvc") {
			t.Error("expected podSpecUsesPVC to return false when no PVC volume")
		}
	})

	t.Run("empty_volumes", func(t *testing.T) {
		spec := corev1.PodSpec{}
		if podSpecUsesPVC(spec, "my-pvc") {
			t.Error("expected podSpecUsesPVC to return false for empty spec")
		}
	})
}

// Additional integration tests for edge count assertions

func TestExpandStatefulSetEdgeCount(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "sts-edge", Namespace: "ns"},
			Spec: appsv1.StatefulSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "sts-edge"}},
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "sts-edge-0",
				Namespace:       "ns",
				OwnerReferences: []metav1.OwnerReference{{Kind: "StatefulSet", Name: "sts-edge"}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "sts-edge-1",
				Namespace:       "ns",
				OwnerReferences: []metav1.OwnerReference{{Kind: "StatefulSet", Name: "sts-edge"}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "statefulset", "sts-edge", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ownsEdges := 0
	for _, e := range graph.Edges {
		if e.Type == EdgeTypeOwns {
			ownsEdges++
		}
	}
	if ownsEdges < 2 {
		t.Errorf("expected at least 2 owns edges, got %d", ownsEdges)
	}
}

func TestExpandCronJobEdgeCount(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "cron-ec", Namespace: "ns"},
			Spec: batchv1.CronJobSpec{
				Schedule: "0 * * * *",
				JobTemplate: batchv1.JobTemplateSpec{
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "busybox"}}},
						},
					},
				},
			},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "cron-ec-job-1",
				Namespace:       "ns",
				OwnerReferences: []metav1.OwnerReference{{Kind: "CronJob", Name: "cron-ec"}},
			},
			Spec: batchv1.JobSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "busybox"}}}}},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "cron-ec-job-2",
				Namespace:       "ns",
				OwnerReferences: []metav1.OwnerReference{{Kind: "CronJob", Name: "cron-ec"}},
			},
			Spec: batchv1.JobSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "busybox"}}}}},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("ns", "cronjob", "cron-ec", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ownsEdges := 0
	for _, e := range graph.Edges {
		if e.Type == EdgeTypeOwns {
			ownsEdges++
		}
	}
	if ownsEdges < 2 {
		t.Errorf("expected at least 2 owns edges, got %d", ownsEdges)
	}
}

func TestExpandNode_k8sEdgeLabel(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-label"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-label", Namespace: "ns"},
			Spec: corev1.PodSpec{
				NodeName:   "node-label",
				Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
			},
		},
	)

	b := NewBuilder(context.Background(), clientset)
	graph, err := b.BuildForResource("", "node", "node-label", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertEdgeLabelContains(t, graph, "pod", "ns", "pod-label", "node", "", "node-label", EdgeTypeRunsOn, "runs on")
}
