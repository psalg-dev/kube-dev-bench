package app

import (
	"context"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// =====================================================================
// More tests for configmaps.go - GetConfigMaps
// =====================================================================

func TestGetConfigMaps_WithData(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "cm1",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-24 * time.Hour)),
				Labels:            map[string]string{"app": "test"},
			},
			Data: map[string]string{
				"config.yaml": "key: value",
				"other.txt":   "some content",
			},
		},
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "cm2",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-1 * time.Hour)),
			},
			BinaryData: map[string][]byte{
				"binary.dat": []byte("binary content"),
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	cms, err := app.GetConfigMaps("default")
	if err != nil {
		t.Fatalf("GetConfigMaps failed: %v", err)
	}
	if len(cms) != 2 {
		t.Errorf("Expected 2 configmaps, got %d", len(cms))
	}
}

func TestGetConfigMaps_EmptyNamespace(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	cms, err := app.GetConfigMaps("empty-namespace")
	if err != nil {
		t.Fatalf("GetConfigMaps failed: %v", err)
	}
	if len(cms) != 0 {
		t.Errorf("Expected 0 configmaps, got %d", len(cms))
	}
}

// =====================================================================
// Tests for daemonsets.go - GetDaemonSets
// =====================================================================

func TestGetDaemonSets_WithResources(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "ds1",
				Namespace:         "kube-system",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-48 * time.Hour)),
				Labels:            map[string]string{"app": "fluent-bit"},
			},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "fluent-bit"}},
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "fluent-bit"}},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{Name: "fluent-bit", Image: "fluent/fluent-bit:latest"},
						},
					},
				},
			},
			Status: appsv1.DaemonSetStatus{
				DesiredNumberScheduled: 3,
				CurrentNumberScheduled: 3,
				NumberReady:            3,
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	dss, err := app.GetDaemonSets("kube-system")
	if err != nil {
		t.Fatalf("GetDaemonSets failed: %v", err)
	}
	if len(dss) != 1 {
		t.Errorf("Expected 1 daemonset, got %d", len(dss))
	}
	if dss[0].Name != "ds1" {
		t.Errorf("Expected name 'ds1', got '%s'", dss[0].Name)
	}
}

// =====================================================================
// Tests for cronjobs.go - GetCronJobs
// =====================================================================

func TestGetCronJobs_WithSchedules(t *testing.T) {
	suspend := false
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "cj1",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-168 * time.Hour)),
				Labels:            map[string]string{"type": "backup"},
			},
			Spec: batchv1.CronJobSpec{
				Schedule: "0 2 * * *",
				Suspend:  &suspend,
				JobTemplate: batchv1.JobTemplateSpec{
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{Name: "backup", Image: "backup:latest"},
								},
								RestartPolicy: corev1.RestartPolicyNever,
							},
						},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	cjs, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("GetCronJobs failed: %v", err)
	}
	if len(cjs) != 1 {
		t.Errorf("Expected 1 cronjob, got %d", len(cjs))
	}
	if cjs[0].Schedule != "0 2 * * *" {
		t.Errorf("Expected schedule '0 2 * * *', got '%s'", cjs[0].Schedule)
	}
}

func TestGetCronJobs_Suspended(t *testing.T) {
	suspend := true
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "suspended-cj",
				Namespace: "default",
			},
			Spec: batchv1.CronJobSpec{
				Schedule: "* * * * *",
				Suspend:  &suspend,
				JobTemplate: batchv1.JobTemplateSpec{
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers:    []corev1.Container{{Name: "c", Image: "img"}},
								RestartPolicy: corev1.RestartPolicyNever,
							},
						},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	cjs, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("GetCronJobs failed: %v", err)
	}
	if len(cjs) != 1 {
		t.Errorf("Expected 1 cronjob, got %d", len(cjs))
	}
	if !cjs[0].Suspend {
		t.Error("Expected cronjob to be suspended")
	}
	if cjs[0].NextRun != "Suspended" {
		t.Errorf("Expected NextRun 'Suspended', got '%s'", cjs[0].NextRun)
	}
}

// =====================================================================
// Tests for ingresses.go - GetIngresses
// =====================================================================

func TestGetIngresses_WithRules(t *testing.T) {
	pathType := networkingv1.PathTypePrefix
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "ing1",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-12 * time.Hour)),
				Labels:            map[string]string{"app": "frontend"},
			},
			Spec: networkingv1.IngressSpec{
				Rules: []networkingv1.IngressRule{
					{
						Host: "example.com",
						IngressRuleValue: networkingv1.IngressRuleValue{
							HTTP: &networkingv1.HTTPIngressRuleValue{
								Paths: []networkingv1.HTTPIngressPath{
									{
										Path:     "/",
										PathType: &pathType,
										Backend: networkingv1.IngressBackend{
											Service: &networkingv1.IngressServiceBackend{
												Name: "frontend-svc",
												Port: networkingv1.ServiceBackendPort{Number: 80},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			Status: networkingv1.IngressStatus{
				LoadBalancer: networkingv1.IngressLoadBalancerStatus{
					Ingress: []networkingv1.IngressLoadBalancerIngress{
						{IP: "10.0.0.100"},
					},
				},
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	ings, err := app.GetIngresses("default")
	if err != nil {
		t.Fatalf("GetIngresses failed: %v", err)
	}
	if len(ings) != 1 {
		t.Errorf("Expected 1 ingress, got %d", len(ings))
	}
}

// =====================================================================
// Tests for persistentvolumes.go - GetPersistentVolumes
// =====================================================================

func TestGetPersistentVolumes_WithResources(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "pv1",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-720 * time.Hour)),
				Labels:            map[string]string{"type": "ssd"},
			},
			Spec: corev1.PersistentVolumeSpec{
				AccessModes:                   []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
				PersistentVolumeReclaimPolicy: corev1.PersistentVolumeReclaimRetain,
				StorageClassName:              "standard",
			},
			Status: corev1.PersistentVolumeStatus{
				Phase: corev1.VolumeAvailable,
			},
		},
		&corev1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "pv2",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-24 * time.Hour)),
			},
			Spec: corev1.PersistentVolumeSpec{
				AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadOnlyMany},
				StorageClassName: "fast",
				ClaimRef: &corev1.ObjectReference{
					Name:      "my-pvc",
					Namespace: "default",
				},
			},
			Status: corev1.PersistentVolumeStatus{
				Phase: corev1.VolumeBound,
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	pvs, err := app.GetPersistentVolumes()
	if err != nil {
		t.Fatalf("GetPersistentVolumes failed: %v", err)
	}
	if len(pvs) != 2 {
		t.Errorf("Expected 2 persistent volumes, got %d", len(pvs))
	}
}

// =====================================================================
// Tests for persistentvolumeclaims.go - GetPersistentVolumeClaims
// =====================================================================

func TestGetPersistentVolumeClaims_WithResources(t *testing.T) {
	storageClass := "standard"
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "pvc1",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-24 * time.Hour)),
			},
			Spec: corev1.PersistentVolumeClaimSpec{
				AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
				StorageClassName: &storageClass,
			},
			Status: corev1.PersistentVolumeClaimStatus{
				Phase: corev1.ClaimBound,
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	pvcs, err := app.GetPersistentVolumeClaims("default")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaims failed: %v", err)
	}
	if len(pvcs) != 1 {
		t.Errorf("Expected 1 PVC, got %d", len(pvcs))
	}
}

// =====================================================================
// Tests for statefulsets.go - GetStatefulSets
// =====================================================================

func TestGetStatefulSets_WithResources(t *testing.T) {
	replicas := int32(3)
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "ss1",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-72 * time.Hour)),
				Labels:            map[string]string{"app": "database"},
			},
			Spec: appsv1.StatefulSetSpec{
				Replicas:    &replicas,
				ServiceName: "db-headless",
				Selector:    &metav1.LabelSelector{MatchLabels: map[string]string{"app": "database"}},
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "database"}},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{Name: "db", Image: "postgres:14"},
						},
					},
				},
			},
			Status: appsv1.StatefulSetStatus{
				Replicas:      3,
				ReadyReplicas: 3,
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	sss, err := app.GetStatefulSets("default")
	if err != nil {
		t.Fatalf("GetStatefulSets failed: %v", err)
	}
	if len(sss) != 1 {
		t.Errorf("Expected 1 statefulset, got %d", len(sss))
	}
}

// =====================================================================
// Tests for replicasets.go - GetReplicaSets
// =====================================================================

func TestGetReplicaSets_WithResources(t *testing.T) {
	replicas := int32(2)
	clientset := fake.NewSimpleClientset(
		&appsv1.ReplicaSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "rs1",
				Namespace:         "default",
				CreationTimestamp: metav1.NewTime(time.Now().Add(-6 * time.Hour)),
				Labels:            map[string]string{"app": "web"},
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "Deployment", Name: "web-deploy"},
				},
			},
			Spec: appsv1.ReplicaSetSpec{
				Replicas: &replicas,
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "web"}},
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "web"}},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{{Name: "web", Image: "nginx"}},
					},
				},
			},
			Status: appsv1.ReplicaSetStatus{
				Replicas:      2,
				ReadyReplicas: 2,
			},
		},
	)

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	rss, err := app.GetReplicaSets("default")
	if err != nil {
		t.Fatalf("GetReplicaSets failed: %v", err)
	}
	if len(rss) != 1 {
		t.Errorf("Expected 1 replicaset, got %d", len(rss))
	}
}
