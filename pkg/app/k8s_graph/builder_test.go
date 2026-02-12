package k8s_graph

import (
	"context"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
)

func assertNode(t *testing.T, graph *ResourceGraph, kind, namespace, name string) {
	t.Helper()
	id := NodeID(kind, namespace, name)
	if !graph.HasNode(id) {
		t.Fatalf("expected node %s to exist", id)
	}
}

func assertNoNode(t *testing.T, graph *ResourceGraph, kind, namespace, name string) {
	t.Helper()
	id := NodeID(kind, namespace, name)
	if graph.HasNode(id) {
		t.Fatalf("expected node %s to be absent", id)
	}
}

func assertEdge(t *testing.T, graph *ResourceGraph, sourceKind, sourceNS, sourceName, targetKind, targetNS, targetName string, edgeType EdgeType) {
	t.Helper()
	srcID := NodeID(sourceKind, sourceNS, sourceName)
	tgtID := NodeID(targetKind, targetNS, targetName)
	wantID := EdgeID(srcID, tgtID, edgeType)
	for _, edge := range graph.Edges {
		if edge.ID == wantID && edge.Type == edgeType {
			return
		}
	}
	t.Fatalf("expected edge %s to exist", wantID)
}

func assertEdgeLabelContains(t *testing.T, graph *ResourceGraph, sourceKind, sourceNS, sourceName, targetKind, targetNS, targetName string, edgeType EdgeType, contains string) {
	t.Helper()
	srcID := NodeID(sourceKind, sourceNS, sourceName)
	tgtID := NodeID(targetKind, targetNS, targetName)
	for _, edge := range graph.Edges {
		if edge.Source == srcID && edge.Target == tgtID && edge.Type == edgeType {
			if contains != "" && !strings.Contains(edge.Label, contains) {
				t.Fatalf("expected edge label to contain %q, got %q", contains, edge.Label)
			}
			return
		}
	}
	t.Fatalf("expected labeled edge from %s to %s of type %s", srcID, tgtID, edgeType)
}

func assertNodeMetadataContains(t *testing.T, graph *ResourceGraph, kind, namespace, name, key, contains string) {
	t.Helper()
	nodeID := NodeID(kind, namespace, name)
	for _, node := range graph.Nodes {
		if node.ID != nodeID {
			continue
		}
		value := node.Metadata[key]
		if !strings.Contains(value, contains) {
			t.Fatalf("expected node %s metadata[%s] to contain %q, got %q", nodeID, key, contains, value)
		}
		return
	}
	t.Fatalf("expected node %s to exist", nodeID)
}

func TestDeploymentOwnerChain(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "demo", Namespace: "default"},
			Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "demo"}}},
		},
		&appsv1.ReplicaSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "demo-rs",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "Deployment",
					Name: "demo",
				}},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "demo-pod",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "ReplicaSet",
					Name: "demo-rs",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "deployment", "demo", 2)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "deployment", "default", "demo")
	assertNode(t, graph, "replicaset", "default", "demo-rs")
	assertNode(t, graph, "pod", "default", "demo-pod")
	assertEdge(t, graph, "deployment", "default", "demo", "replicaset", "default", "demo-rs", EdgeTypeOwns)
	assertEdge(t, graph, "replicaset", "default", "demo-rs", "pod", "default", "demo-pod", EdgeTypeOwns)
}

func TestServiceSelectsPod(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-pod", Namespace: "default", Labels: map[string]string{"app": "demo"}},
			Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-svc", Namespace: "default"},
			Spec: corev1.ServiceSpec{
				Selector: map[string]string{"app": "demo"},
				Ports:    []corev1.ServicePort{{Port: 80, TargetPort: intstr.FromInt(80)}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "service", "demo-svc", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "service", "default", "demo-svc")
	assertNode(t, graph, "pod", "default", "demo-pod")
	assertEdge(t, graph, "service", "default", "demo-svc", "pod", "default", "demo-pod", EdgeTypeSelects)
}

func TestConfigMapConsumers(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "demo-cm", Namespace: "default"}},
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-deploy", Namespace: "default"},
			Spec: appsv1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "app",
							EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "demo-cm"}}}},
						}},
					},
				},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "configmap", "demo-cm", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "configmap", "default", "demo-cm")
	assertNode(t, graph, "deployment", "default", "demo-deploy")
	assertEdge(t, graph, "deployment", "default", "demo-deploy", "configmap", "default", "demo-cm", EdgeTypeMounts)
}

func TestPVCGraph(t *testing.T) {
	sc := &storagev1.StorageClass{ObjectMeta: metav1.ObjectMeta{Name: "fast"}}
	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pv-demo"},
		Spec: corev1.PersistentVolumeSpec{
			StorageClassName: "fast",
			ClaimRef:         &corev1.ObjectReference{Namespace: "default", Name: "demo-pvc"},
		},
	}
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "demo-pvc", Namespace: "default"},
		Spec: corev1.PersistentVolumeClaimSpec{
			VolumeName:       "pv-demo",
			StorageClassName: strPtr("fast"),
		},
	}

	clientset := fake.NewSimpleClientset(sc, pv, pvc)
	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "persistentvolumeclaim", "demo-pvc", 2)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "persistentvolumeclaim", "default", "demo-pvc")
	assertNode(t, graph, "persistentvolume", "", "pv-demo")
	assertNode(t, graph, "storageclass", "", "fast")
	assertEdge(t, graph, "persistentvolumeclaim", "default", "demo-pvc", "persistentvolume", "", "pv-demo", EdgeTypeBoundTo)
	assertEdge(t, graph, "storageclass", "", "fast", "persistentvolumeclaim", "default", "demo-pvc", EdgeTypeProvides)
}

func TestIngressServicePodChain(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-pod", Namespace: "default", Labels: map[string]string{"app": "demo"}},
			Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-svc", Namespace: "default"},
			Spec: corev1.ServiceSpec{
				Selector: map[string]string{"app": "demo"},
				Ports:    []corev1.ServicePort{{Port: 80, TargetPort: intstr.FromInt(80)}},
			},
		},
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-ing", Namespace: "default"},
			Spec: networkingv1.IngressSpec{
				Rules: []networkingv1.IngressRule{{
					IngressRuleValue: networkingv1.IngressRuleValue{
						HTTP: &networkingv1.HTTPIngressRuleValue{
							Paths: []networkingv1.HTTPIngressPath{{
								Backend: networkingv1.IngressBackend{
									Service: &networkingv1.IngressServiceBackend{Name: "demo-svc", Port: networkingv1.ServiceBackendPort{Number: 80}},
								},
							}},
						},
					},
				}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "ingress", "demo-ing", 2)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "ingress", "default", "demo-ing")
	assertNode(t, graph, "service", "default", "demo-svc")
	assertNode(t, graph, "pod", "default", "demo-pod")
	assertEdge(t, graph, "ingress", "default", "demo-ing", "service", "default", "demo-svc", EdgeTypeRoutesTo)
	assertEdge(t, graph, "service", "default", "demo-svc", "pod", "default", "demo-pod", EdgeTypeSelects)
}

func TestRoleBindingRelationships(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "demo-role", Namespace: "default"}},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "demo-sa", Namespace: "default"}},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-rb", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "demo-role"},
			Subjects:   []rbacv1.Subject{{Kind: "ServiceAccount", Name: "demo-sa", Namespace: "default"}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "rolebinding", "demo-rb", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "rolebinding", "default", "demo-rb")
	assertNode(t, graph, "role", "default", "demo-role")
	assertNode(t, graph, "serviceaccount", "default", "demo-sa")
	assertEdge(t, graph, "rolebinding", "default", "demo-rb", "role", "default", "demo-role", EdgeTypeBinds)
	assertEdge(t, graph, "rolebinding", "default", "demo-rb", "serviceaccount", "default", "demo-sa", EdgeTypeBinds)
}

func TestPodRunsOnNode(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "node-1"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-pod", Namespace: "default"},
			Spec: corev1.PodSpec{
				NodeName:   "node-1",
				Containers: []corev1.Container{{Name: "app", Image: "nginx"}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "pod", "demo-pod", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "pod", "default", "demo-pod")
	assertNode(t, graph, "node", "", "node-1")
	assertEdge(t, graph, "pod", "default", "demo-pod", "node", "", "node-1", EdgeTypeRunsOn)
}

func TestHPAScalesTargetWorkload(t *testing.T) {
	minReplicas := int32(1)
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "default"},
			Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "web"}}},
		},
		&autoscalingv2.HorizontalPodAutoscaler{
			ObjectMeta: metav1.ObjectMeta{Name: "web-hpa", Namespace: "default"},
			Spec: autoscalingv2.HorizontalPodAutoscalerSpec{
				ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "web", APIVersion: "apps/v1"},
				MinReplicas:    &minReplicas,
				MaxReplicas:    5,
			},
			Status: autoscalingv2.HorizontalPodAutoscalerStatus{
				CurrentReplicas: 2,
				DesiredReplicas: 3,
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "deployment", "web", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "deployment", "default", "web")
	assertNode(t, graph, "horizontalpodautoscaler", "default", "web-hpa")
	assertEdge(t, graph, "horizontalpodautoscaler", "default", "web-hpa", "deployment", "default", "web", EdgeTypeScales)
}

func TestNamespaceGraphIncludesRelationships(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "demo", Namespace: "default"},
			Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "demo"}}},
		},
		&appsv1.ReplicaSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "demo-rs",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "Deployment",
					Name: "demo",
				}},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "demo-pod",
				Namespace: "default",
				Labels:    map[string]string{"app": "demo"},
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "ReplicaSet",
					Name: "demo-rs",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-svc", Namespace: "default"},
			Spec: corev1.ServiceSpec{
				Selector: map[string]string{"app": "demo"},
				Ports:    []corev1.ServicePort{{Port: 80, TargetPort: intstr.FromInt(80)}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForNamespace("default", 1)
	if err != nil {
		t.Fatalf("BuildForNamespace error: %v", err)
	}

	assertNode(t, graph, "deployment", "default", "demo")
	assertNode(t, graph, "replicaset", "default", "demo-rs")
	assertNode(t, graph, "pod", "default", "demo-pod")
	assertNode(t, graph, "service", "default", "demo-svc")
	assertEdge(t, graph, "deployment", "default", "demo", "replicaset", "default", "demo-rs", EdgeTypeOwns)
	assertEdge(t, graph, "service", "default", "demo-svc", "pod", "default", "demo-pod", EdgeTypeSelects)
}

func TestDepthLimit(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "demo", Namespace: "default"},
			Spec:       appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "demo"}}},
		},
		&appsv1.ReplicaSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "demo-rs",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "Deployment",
					Name: "demo",
				}},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "demo-pod",
				Namespace: "default",
				OwnerReferences: []metav1.OwnerReference{{
					Kind: "ReplicaSet",
					Name: "demo-rs",
				}},
			},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "deployment", "demo", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "deployment", "default", "demo")
	assertNode(t, graph, "replicaset", "default", "demo-rs")
	assertNoNode(t, graph, "pod", "default", "demo-pod")
}

func strPtr(value string) *string {
	return &value
}

func TestSecretConsumers(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "demo-secret", Namespace: "default"}},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "demo-job", Namespace: "default"},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{
							Name:    "app",
							EnvFrom: []corev1.EnvFromSource{{SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "demo-secret"}}}},
						}},
					},
				},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "secret", "demo-secret", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "secret", "default", "demo-secret")
	assertNode(t, graph, "job", "default", "demo-job")
	assertEdge(t, graph, "job", "default", "demo-job", "secret", "default", "demo-secret", EdgeTypeMounts)
}

func TestConfigMapConsumersAcrossWorkloads(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "shared-cm", Namespace: "default"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "cm-pod", Namespace: "default"},
			Spec: corev1.PodSpec{Containers: []corev1.Container{{
				Name:    "app",
				EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "shared-cm"}}}},
			}}},
		},
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "cm-deploy", Namespace: "default"},
			Spec: appsv1.DeploymentSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{
				Name:    "app",
				EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "shared-cm"}}}},
			}}}}},
		},
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{Name: "cm-sts", Namespace: "default"},
			Spec: appsv1.StatefulSetSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{
				Name: "app",
				Env:  []corev1.EnvVar{{Name: "VALUE", ValueFrom: &corev1.EnvVarSource{ConfigMapKeyRef: &corev1.ConfigMapKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "shared-cm"}, Key: "key"}}}},
			}}}}},
		},
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{Name: "cm-ds", Namespace: "default"},
			Spec: appsv1.DaemonSetSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Volumes: []corev1.Volume{{
				Name:         "cfg",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "shared-cm"}}},
			}}}}},
		},
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "cm-job", Namespace: "default"},
			Spec: batchv1.JobSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{
				Name:    "app",
				EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "shared-cm"}}}},
			}}}}},
		},
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{Name: "cm-cj", Namespace: "default"},
			Spec: batchv1.CronJobSpec{
				Schedule: "*/5 * * * *",
				JobTemplate: batchv1.JobTemplateSpec{Spec: batchv1.JobSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{
					Name:    "app",
					EnvFrom: []corev1.EnvFromSource{{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "shared-cm"}}}},
				}}}}}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildForResource("default", "configmap", "shared-cm", 1)
	if err != nil {
		t.Fatalf("BuildForResource error: %v", err)
	}

	assertNode(t, graph, "configmap", "default", "shared-cm")
	assertEdge(t, graph, "pod", "default", "cm-pod", "configmap", "default", "shared-cm", EdgeTypeMounts)
	assertEdge(t, graph, "deployment", "default", "cm-deploy", "configmap", "default", "shared-cm", EdgeTypeMounts)
	assertEdge(t, graph, "statefulset", "default", "cm-sts", "configmap", "default", "shared-cm", EdgeTypeMounts)
	assertEdge(t, graph, "daemonset", "default", "cm-ds", "configmap", "default", "shared-cm", EdgeTypeMounts)
	assertEdge(t, graph, "job", "default", "cm-job", "configmap", "default", "shared-cm", EdgeTypeMounts)
	assertEdge(t, graph, "cronjob", "default", "cm-cj", "configmap", "default", "shared-cm", EdgeTypeMounts)
}

func TestBuildForResourceMissingResourceReturnsError(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	builder := NewBuilder(context.Background(), clientset)

	_, err := builder.BuildForResource("default", "deployment", "does-not-exist", 2)
	if err == nil {
		t.Fatalf("expected an error for missing resource")
	}
}

func TestBuildStorageGraph(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{Name: "data-pvc", Namespace: "default"},
			Spec: corev1.PersistentVolumeClaimSpec{
				VolumeName:       "data-pv",
				StorageClassName: strPtr("fast"),
			},
		},
		&corev1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{Name: "data-pv"},
			Spec: corev1.PersistentVolumeSpec{
				StorageClassName: "fast",
				ClaimRef: &corev1.ObjectReference{
					Namespace: "default",
					Name:      "data-pvc",
				},
			},
		},
		&storagev1.StorageClass{ObjectMeta: metav1.ObjectMeta{Name: "fast"}},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildStorageGraph("default", 2)
	if err != nil {
		t.Fatalf("BuildStorageGraph error: %v", err)
	}

	assertNode(t, graph, "persistentvolumeclaim", "default", "data-pvc")
	assertNode(t, graph, "persistentvolume", "", "data-pv")
	assertNode(t, graph, "storageclass", "", "fast")
	assertEdge(t, graph, "persistentvolumeclaim", "default", "data-pvc", "persistentvolume", "", "data-pv", EdgeTypeBoundTo)
}

func TestBuildNetworkPolicyGraph(t *testing.T) {
	protocolTCP := corev1.ProtocolTCP
	protocolUDP := corev1.ProtocolUDP
	port80 := intstr.FromInt(80)
	port53 := intstr.FromInt(53)

	clientset := fake.NewSimpleClientset(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "default"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "api-pod", Namespace: "default", Labels: map[string]string{"app": "api"}},
			Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "frontend-pod", Namespace: "default", Labels: map[string]string{"tier": "frontend"}},
			Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "app", Image: "nginx"}}},
		},
		&networkingv1.NetworkPolicy{
			ObjectMeta: metav1.ObjectMeta{Name: "api-policy", Namespace: "default"},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{MatchLabels: map[string]string{"app": "api"}},
				PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress, networkingv1.PolicyTypeEgress},
				Ingress: []networkingv1.NetworkPolicyIngressRule{{
					Ports: []networkingv1.NetworkPolicyPort{{Protocol: &protocolTCP, Port: &port80}},
					From: []networkingv1.NetworkPolicyPeer{{
						PodSelector: &metav1.LabelSelector{MatchLabels: map[string]string{"tier": "frontend"}},
					}},
				}},
				Egress: []networkingv1.NetworkPolicyEgressRule{{
					Ports: []networkingv1.NetworkPolicyPort{{Protocol: &protocolUDP, Port: &port53}},
					To: []networkingv1.NetworkPolicyPeer{{
						IPBlock: &networkingv1.IPBlock{CIDR: "10.96.0.0/12"},
					}},
				}},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildNetworkPolicyGraph("default")
	if err != nil {
		t.Fatalf("BuildNetworkPolicyGraph error: %v", err)
	}

	assertNode(t, graph, "networkpolicy", "default", "api-policy")
	assertNode(t, graph, "pod", "default", "api-pod")
	assertNode(t, graph, "pod", "default", "frontend-pod")
	assertNode(t, graph, "external", "", "10.96.0.0/12")

	assertEdge(t, graph, "networkpolicy", "default", "api-policy", "pod", "default", "api-pod", EdgeTypeNetworkPolicy)
	assertEdgeLabelContains(t, graph, "pod", "default", "frontend-pod", "pod", "default", "api-pod", EdgeTypeNPIngress, "ingress")
	assertEdgeLabelContains(t, graph, "pod", "default", "api-pod", "external", "", "10.96.0.0/12", EdgeTypeNPEgress, "53/UDP")
}

func TestBuildRBACGraph(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "app-sa", Namespace: "default"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "app-pod", Namespace: "default"},
			Spec: corev1.PodSpec{
				ServiceAccountName: "app-sa",
				Containers:         []corev1.Container{{Name: "app", Image: "nginx"}},
			},
		},
		&rbacv1.Role{
			ObjectMeta: metav1.ObjectMeta{Name: "reader", Namespace: "default"},
			Rules: []rbacv1.PolicyRule{{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{"get", "list"},
			}},
		},
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "reader-binding", Namespace: "default"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "Role", Name: "reader"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "app-sa", Namespace: "default"},
				{Kind: "User", APIGroup: "rbac.authorization.k8s.io", Name: "alice"},
			},
		},
		&rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{Name: "cluster-admin-lite"},
			Rules: []rbacv1.PolicyRule{{
				APIGroups: []string{"apps"},
				Resources: []string{"deployments"},
				Verbs:     []string{"get"},
			}},
		},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "global-admin-binding"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "cluster-admin-lite"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "app-sa", Namespace: "default"},
			},
		},
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: "other-ns-binding"},
			RoleRef:    rbacv1.RoleRef{APIGroup: "rbac.authorization.k8s.io", Kind: "ClusterRole", Name: "cluster-admin-lite"},
			Subjects: []rbacv1.Subject{
				{Kind: "ServiceAccount", Name: "other-sa", Namespace: "other"},
			},
		},
	)

	builder := NewBuilder(context.Background(), clientset)
	graph, err := builder.BuildRBACGraph("default")
	if err != nil {
		t.Fatalf("BuildRBACGraph error: %v", err)
	}

	assertNode(t, graph, "pod", "default", "app-pod")
	assertNode(t, graph, "serviceaccount", "default", "app-sa")
	assertNode(t, graph, "rolebinding", "default", "reader-binding")
	assertNode(t, graph, "role", "default", "reader")
	assertNode(t, graph, "user", "", "alice")
	assertNode(t, graph, "clusterrolebinding", "", "global-admin-binding")
	assertNode(t, graph, "clusterrole", "", "cluster-admin-lite")

	assertEdgeLabelContains(t, graph, "pod", "default", "app-pod", "serviceaccount", "default", "app-sa", EdgeTypeBinds, "uses")
	assertEdgeLabelContains(t, graph, "serviceaccount", "default", "app-sa", "rolebinding", "default", "reader-binding", EdgeTypeBinds, "subject")
	assertEdgeLabelContains(t, graph, "user", "", "alice", "rolebinding", "default", "reader-binding", EdgeTypeBinds, "subject")
	assertEdgeLabelContains(t, graph, "rolebinding", "default", "reader-binding", "role", "default", "reader", EdgeTypeBinds, "binds to")
	assertEdgeLabelContains(t, graph, "serviceaccount", "default", "app-sa", "clusterrolebinding", "", "global-admin-binding", EdgeTypeBinds, "subject")
	assertEdgeLabelContains(t, graph, "clusterrolebinding", "", "global-admin-binding", "clusterrole", "", "cluster-admin-lite", EdgeTypeBinds, "binds to")

	assertNoNode(t, graph, "clusterrolebinding", "", "other-ns-binding")
	assertNodeMetadataContains(t, graph, "role", "default", "reader", "rules", "pods")
	assertNodeMetadataContains(t, graph, "clusterrole", "", "cluster-admin-lite", "rules", "deployments")
}
