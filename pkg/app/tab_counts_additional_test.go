package app

import (
	"context"
	"path/filepath"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetPodsCountForResource_Success(t *testing.T) {
	ctx := context.Background()
	ns := "default"

	tests := []struct {
		name         string
		kind         string
		resource     string
		setupObjects func(cs *fake.Clientset)
	}{
		{
			name:     "deployment",
			kind:     "Deployment",
			resource: "dep1",
			setupObjects: func(cs *fake.Clientset) {
				labels := map[string]string{"app": "dep"}
				_, _ = cs.AppsV1().Deployments(ns).Create(ctx, &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "dep1", Namespace: ns},
					Spec: appsv1.DeploymentSpec{
						Selector: &metav1.LabelSelector{MatchLabels: labels},
						Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
					},
				}, metav1.CreateOptions{})
				_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "dep-pod",
						Namespace: ns,
						Labels:    labels,
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "Deployment", Name: "dep1"},
						},
					},
				}, metav1.CreateOptions{})
			},
		},
		{
			name:     "statefulset",
			kind:     "StatefulSet",
			resource: "db",
			setupObjects: func(cs *fake.Clientset) {
				labels := map[string]string{"app": "db"}
				_, _ = cs.AppsV1().StatefulSets(ns).Create(ctx, &appsv1.StatefulSet{
					ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: ns},
					Spec: appsv1.StatefulSetSpec{
						ServiceName: "db-svc",
						Selector:    &metav1.LabelSelector{MatchLabels: labels},
						Template:    v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
					},
				}, metav1.CreateOptions{})
				_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "db-0",
						Namespace: ns,
						Labels:    labels,
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "StatefulSet", Name: "db"},
						},
					},
				}, metav1.CreateOptions{})
			},
		},
		{
			name:     "daemonset",
			kind:     "DaemonSet",
			resource: "ds1",
			setupObjects: func(cs *fake.Clientset) {
				labels := map[string]string{"app": "ds"}
				_, _ = cs.AppsV1().DaemonSets(ns).Create(ctx, &appsv1.DaemonSet{
					ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: ns},
					Spec: appsv1.DaemonSetSpec{
						Selector: &metav1.LabelSelector{MatchLabels: labels},
						Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
					},
				}, metav1.CreateOptions{})
				_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "ds-pod",
						Namespace: ns,
						Labels:    labels,
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "DaemonSet", Name: "ds1"},
						},
					},
				}, metav1.CreateOptions{})
			},
		},
		{
			name:     "replicaset",
			kind:     "ReplicaSet",
			resource: "rs1",
			setupObjects: func(cs *fake.Clientset) {
				labels := map[string]string{"app": "rs"}
				_, _ = cs.AppsV1().ReplicaSets(ns).Create(ctx, &appsv1.ReplicaSet{
					ObjectMeta: metav1.ObjectMeta{Name: "rs1", Namespace: ns},
					Spec: appsv1.ReplicaSetSpec{
						Selector: &metav1.LabelSelector{MatchLabels: labels},
						Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
					},
				}, metav1.CreateOptions{})
				_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "rs-pod",
						Namespace: ns,
						Labels:    labels,
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "ReplicaSet", Name: "rs1"},
						},
					},
				}, metav1.CreateOptions{})
			},
		},
		{
			name:     "job",
			kind:     "Job",
			resource: "job1",
			setupObjects: func(cs *fake.Clientset) {
				labels := map[string]string{"job": "batch"}
				_, _ = cs.BatchV1().Jobs(ns).Create(ctx, &batchv1.Job{
					ObjectMeta: metav1.ObjectMeta{Name: "job1", Namespace: ns},
					Spec: batchv1.JobSpec{
						Selector: &metav1.LabelSelector{MatchLabels: labels},
						Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
					},
				}, metav1.CreateOptions{})
				_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "job-pod",
						Namespace: ns,
						Labels:    labels,
						OwnerReferences: []metav1.OwnerReference{
							{Kind: "Job", Name: "job1"},
						},
					},
				}, metav1.CreateOptions{})
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cs := fake.NewSimpleClientset()
			tt.setupObjects(cs)
			app := newTestAppWithClientset(cs)

			count, err := app.GetPodsCountForResource(ns, tt.kind, tt.resource)
			if err != nil {
				t.Fatalf("GetPodsCountForResource error: %v", err)
			}
			if count != 1 {
				t.Fatalf("GetPodsCountForResource count = %d, want 1", count)
			}
		})
	}
}

func TestGetPVCConsumersCount(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset()
	_, _ = cs.CoreV1().Pods(ns).Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod1", Namespace: ns},
		Spec: v1.PodSpec{
			Volumes: []v1.Volume{
				{
					Name: "data",
					VolumeSource: v1.VolumeSource{
						PersistentVolumeClaim: &v1.PersistentVolumeClaimVolumeSource{
							ClaimName: "pvc1",
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})

	app := newTestAppWithClientset(cs)
	count, err := app.GetPVCConsumersCount(ns, "pvc1")
	if err != nil {
		t.Fatalf("GetPVCConsumersCount error: %v", err)
	}
	if count != 1 {
		t.Fatalf("GetPVCConsumersCount count = %d, want 1", count)
	}
}

func TestGetWorkloadPodCountAndStatefulSetCounts(t *testing.T) {
	ctx := context.Background()
	ns := "default"
	labels := map[string]string{"app": "db"}

	cs := fake.NewSimpleClientset()
	_, _ = cs.AppsV1().StatefulSets(ns).Create(ctx, &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: ns},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: "db-svc",
			Selector:    &metav1.LabelSelector{MatchLabels: labels},
			Template:    v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
		},
	}, metav1.CreateOptions{})
	_, _ = cs.CoreV1().Pods(ns).Create(ctx, &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-0",
			Namespace: ns,
			Labels:    labels,
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "StatefulSet", Name: "db"},
			},
		},
	}, metav1.CreateOptions{})
	_, _ = cs.CoreV1().PersistentVolumeClaims(ns).Create(ctx, &v1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "data-db-0",
			Namespace: ns,
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "StatefulSet", Name: "db"},
			},
		},
	}, metav1.CreateOptions{})

	app := newTestAppWithClientset(cs)

	if count := app.getWorkloadPodCount(ns, "StatefulSet", "db"); count != 1 {
		t.Fatalf("getWorkloadPodCount = %d, want 1", count)
	}
	if count := app.getWorkloadPodCount(ns, "StatefulSet", "missing"); count != 0 {
		t.Fatalf("getWorkloadPodCount missing = %d, want 0", count)
	}

	pods, pvcs := app.getStatefulSetCounts(ns, "db")
	if pods != 1 || pvcs != 1 {
		t.Fatalf("getStatefulSetCounts = pods %d pvcs %d, want 1/1", pods, pvcs)
	}
}

func TestTabCounts_ReturnsErrorWhenKubeConfigMissing(t *testing.T) {
	app := &App{
		ctx:        context.Background(),
		kubeConfig: filepath.Join(t.TempDir(), "missing"),
	}

	tests := []struct {
		name string
		fn   func() (int, error)
	}{
		{"resource events", func() (int, error) { return app.GetResourceEventsCount("default", "ConfigMap", "example") }},
		{"pvc consumers", func() (int, error) { return app.GetPVCConsumersCount("default", "pvc1") }},
		{"cronjob history", func() (int, error) { return app.GetCronJobHistoryCount("default", "cron") }},
		{"service endpoints", func() (int, error) { return app.GetServiceEndpointsCount("default", "svc") }},
		{"configmap data", func() (int, error) { return app.GetConfigMapDataCount("default", "cm") }},
		{"secret data", func() (int, error) { return app.GetSecretDataCount("default", "sec") }},
		{"statefulset pvcs", func() (int, error) { return app.GetStatefulSetPVCsCount("default", "sts") }},
		{"ingress rules", func() (int, error) { return app.GetIngressRulesCount("default", "ing") }},
	}

	for _, tt := range tests {
		if _, err := tt.fn(); err == nil {
			t.Fatalf("expected error for %s", tt.name)
		}
	}
}
