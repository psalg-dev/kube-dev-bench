package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetOverview function
func TestGetOverview(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	tests := []struct {
		name            string
		namespace       string
		pods            []v1.Pod
		deployments     []appsv1.Deployment
		jobs            []batchv1.Job
		expectedPods    int
		expectedDeploys int
		expectedJobs    int
	}{
		{
			name:            "empty namespace",
			namespace:       "default",
			pods:            []v1.Pod{},
			deployments:     []appsv1.Deployment{},
			jobs:            []batchv1.Job{},
			expectedPods:    0,
			expectedDeploys: 0,
			expectedJobs:    0,
		},
		{
			name:      "with resources",
			namespace: "default",
			pods: []v1.Pod{
				{ObjectMeta: metav1.ObjectMeta{Name: "pod-1", Namespace: "default"}},
				{ObjectMeta: metav1.ObjectMeta{Name: "pod-2", Namespace: "default"}},
				{ObjectMeta: metav1.ObjectMeta{Name: "pod-3", Namespace: "default"}},
			},
			deployments: []appsv1.Deployment{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "deploy-1", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "nginx"}},
							},
						},
					},
				},
			},
			jobs: []batchv1.Job{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "job-1", Namespace: "default"},
					Spec: batchv1.JobSpec{
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers:    []v1.Container{{Image: "busybox"}},
								RestartPolicy: v1.RestartPolicyNever,
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "job-2", Namespace: "default"},
					Spec: batchv1.JobSpec{
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers:    []v1.Container{{Image: "busybox"}},
								RestartPolicy: v1.RestartPolicyNever,
							},
						},
					},
				},
			},
			expectedPods:    3,
			expectedDeploys: 1,
			expectedJobs:    2,
		},
		{
			name:      "only counts resources in specified namespace",
			namespace: "target-ns",
			pods: []v1.Pod{
				{ObjectMeta: metav1.ObjectMeta{Name: "pod-1", Namespace: "target-ns"}},
				{ObjectMeta: metav1.ObjectMeta{Name: "pod-2", Namespace: "other-ns"}},
			},
			deployments: []appsv1.Deployment{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "deploy-1", Namespace: "target-ns"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "nginx"}},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "deploy-2", Namespace: "other-ns"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Template: v1.PodTemplateSpec{
							Spec: v1.PodSpec{
								Containers: []v1.Container{{Image: "nginx"}},
							},
						},
					},
				},
			},
			jobs:            []batchv1.Job{},
			expectedPods:    1,
			expectedDeploys: 1,
			expectedJobs:    0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()

			// Create pods
			for _, p := range tc.pods {
				_, err := clientset.CoreV1().Pods(p.Namespace).Create(
					context.Background(), &p, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create pod: %v", err)
				}
			}

			// Create deployments
			for _, d := range tc.deployments {
				_, err := clientset.AppsV1().Deployments(d.Namespace).Create(
					context.Background(), &d, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create deployment: %v", err)
				}
			}

			// Create jobs
			for _, j := range tc.jobs {
				_, err := clientset.BatchV1().Jobs(j.Namespace).Create(
					context.Background(), &j, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create job: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetOverview(tc.namespace)
			if err != nil {
				t.Fatalf("GetOverview failed: %v", err)
			}

			if result.Pods != tc.expectedPods {
				t.Errorf("expected %d pods, got %d", tc.expectedPods, result.Pods)
			}
			if result.Deployments != tc.expectedDeploys {
				t.Errorf("expected %d deployments, got %d", tc.expectedDeploys, result.Deployments)
			}
			if result.Jobs != tc.expectedJobs {
				t.Errorf("expected %d jobs, got %d", tc.expectedJobs, result.Jobs)
			}
		})
	}
}
