package app

import (
	"context"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
)

func TestComputeNextRunString_ValidSchedule(t *testing.T) {
	// Use a fixed base time for reproducible results
	base := time.Date(2024, 1, 15, 10, 0, 0, 0, time.Local)

	tests := []struct {
		name     string
		schedule string
		wantErr  bool
	}{
		{"every minute", "* * * * *", false},
		{"every hour", "0 * * * *", false},
		{"daily at midnight", "0 0 * * *", false},
		{"weekly on Monday", "0 0 * * 1", false},
		{"monthly on 1st", "0 0 1 * *", false},
		{"specific time", "30 14 * * *", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := computeNextRunString(tc.schedule, base)
			if tc.wantErr {
				if result != "-" {
					t.Errorf("computeNextRunString(%q) = %q, want '-' for error", tc.schedule, result)
				}
			} else {
				if result == "-" {
					t.Errorf("computeNextRunString(%q) returned '-', expected valid time", tc.schedule)
				}
				// Verify it's a valid date format
				_, err := time.Parse("2006-01-02 15:04", result)
				if err != nil {
					t.Errorf("computeNextRunString(%q) = %q, not valid date format: %v", tc.schedule, result, err)
				}
			}
		})
	}
}

func TestComputeNextRunString_InvalidSchedule(t *testing.T) {
	base := time.Now()

	tests := []struct {
		name     string
		schedule string
	}{
		{"empty string", ""},
		{"invalid format", "not a cron schedule"},
		{"too few fields", "* * *"},
		{"invalid values", "60 * * * *"},
		{"invalid day", "* * 32 * *"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := computeNextRunString(tc.schedule, base)
			if result != "-" {
				t.Errorf("computeNextRunString(%q) = %q, want '-' for invalid schedule", tc.schedule, result)
			}
		})
	}
}

func TestComputeNextRunString_NextOccurrence(t *testing.T) {
	// Test that next occurrence is actually in the future
	base := time.Date(2024, 1, 15, 10, 30, 0, 0, time.Local)

	// Every hour at minute 0
	result := computeNextRunString("0 * * * *", base)
	if result == "-" {
		t.Fatal("Expected valid result")
	}

	nextTime, err := time.ParseInLocation("2006-01-02 15:04", result, time.Local)
	if err != nil {
		t.Fatalf("Failed to parse result: %v", err)
	}

	if !nextTime.After(base) {
		t.Errorf("Next occurrence %v should be after base time %v", nextTime, base)
	}
}

func TestComputeNextRunString_EveryMinute(t *testing.T) {
	base := time.Date(2024, 1, 15, 10, 30, 30, 0, time.Local)

	result := computeNextRunString("* * * * *", base)
	if result == "-" {
		t.Fatal("Expected valid result")
	}

	nextTime, err := time.ParseInLocation("2006-01-02 15:04", result, time.Local)
	if err != nil {
		t.Fatalf("Failed to parse result: %v", err)
	}

	// Next minute should be 10:31
	expected := time.Date(2024, 1, 15, 10, 31, 0, 0, time.Local)
	if !nextTime.Equal(expected) {
		t.Errorf("Expected %v, got %v", expected.Format("2006-01-02 15:04"), nextTime.Format("2006-01-02 15:04"))
	}
}

// Tests for GetCronJobs function
func TestGetCronJobs(t *testing.T) {
	boolPtr := func(b bool) *bool { return &b }

	tests := []struct {
		name      string
		namespace string
		cronjobs  []batchv1.CronJob
		expected  int
	}{
		{
			name:      "empty namespace",
			namespace: "default",
			cronjobs:  []batchv1.CronJob{},
			expected:  0,
		},
		{
			name:      "single cronjob",
			namespace: "default",
			cronjobs: []batchv1.CronJob{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "backup-job",
						Namespace: "default",
						Labels:    map[string]string{"app": "backup"},
					},
					Spec: batchv1.CronJobSpec{
						Schedule: "0 0 * * *",
						Suspend:  boolPtr(false),
						JobTemplate: batchv1.JobTemplateSpec{
							Spec: batchv1.JobSpec{
								Template: v1.PodTemplateSpec{
									Spec: v1.PodSpec{
										Containers: []v1.Container{
											{Image: "backup:latest"},
										},
									},
								},
							},
						},
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple cronjobs",
			namespace: "default",
			cronjobs: []batchv1.CronJob{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "backup", Namespace: "default"},
					Spec: batchv1.CronJobSpec{
						Schedule: "0 0 * * *",
						JobTemplate: batchv1.JobTemplateSpec{
							Spec: batchv1.JobSpec{
								Template: v1.PodTemplateSpec{
									Spec: v1.PodSpec{
										Containers: []v1.Container{{Image: "backup:v1"}},
									},
								},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "cleanup", Namespace: "default"},
					Spec: batchv1.CronJobSpec{
						Schedule: "0 * * * *",
						JobTemplate: batchv1.JobTemplateSpec{
							Spec: batchv1.JobSpec{
								Template: v1.PodTemplateSpec{
									Spec: v1.PodSpec{
										Containers: []v1.Container{{Image: "cleanup:v1"}},
									},
								},
							},
						},
					},
				},
			},
			expected: 2,
		},
		{
			name:      "cronjobs in different namespaces",
			namespace: "target-ns",
			cronjobs: []batchv1.CronJob{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "job1", Namespace: "target-ns"},
					Spec: batchv1.CronJobSpec{
						Schedule: "0 0 * * *",
						JobTemplate: batchv1.JobTemplateSpec{
							Spec: batchv1.JobSpec{
								Template: v1.PodTemplateSpec{
									Spec: v1.PodSpec{
										Containers: []v1.Container{{Image: "job1:v1"}},
									},
								},
							},
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "job2", Namespace: "other-ns"},
					Spec: batchv1.CronJobSpec{
						Schedule: "0 0 * * *",
						JobTemplate: batchv1.JobTemplateSpec{
							Spec: batchv1.JobSpec{
								Template: v1.PodTemplateSpec{
									Spec: v1.PodSpec{
										Containers: []v1.Container{{Image: "job2:v1"}},
									},
								},
							},
						},
					},
				},
			},
			expected: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, cj := range tc.cronjobs {
				_, err := clientset.BatchV1().CronJobs(cj.Namespace).Create(
					context.Background(), &cj, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create cronjob: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetCronJobs(tc.namespace)
			if err != nil {
				t.Fatalf("GetCronJobs failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetCronJobs(%q) returned %d cronjobs, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestStartCronJobPolling_ListActions(t *testing.T) {
	disableWailsEvents = true

	clientset := fake.NewSimpleClientset(&batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj-1", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule:    "* * * * *",
			JobTemplate: batchv1.JobTemplateSpec{Spec: batchv1.JobSpec{Template: v1.PodTemplateSpec{Spec: v1.PodSpec{}}}},
		},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app := &App{
		ctx:              ctx,
		currentNamespace: "default",
		testClientset:    clientset,
	}

	app.StartCronJobPolling()
	start := time.Now()
	for time.Since(start) < 1500*time.Millisecond {
		if hasListAction(clientset.Actions(), "cronjobs") {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	cancel()

	if !hasListAction(clientset.Actions(), "cronjobs") {
		t.Fatalf("expected cronjobs list action")
	}
}

func hasListAction(actions []clienttesting.Action, resource string) bool {
	for _, action := range actions {
		if action.Matches("list", resource) {
			return true
		}
	}
	return false
}

func TestGetCronJobs_Details(t *testing.T) {
	boolPtr := func(b bool) *bool { return &b }

	clientset := fake.NewSimpleClientset()
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "daily-backup",
			Namespace: "default",
			Labels:    map[string]string{"app": "backup", "env": "prod"},
		},
		Spec: batchv1.CronJobSpec{
			Schedule: "0 2 * * *",
			Suspend:  boolPtr(false),
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: v1.PodTemplateSpec{
						ObjectMeta: metav1.ObjectMeta{
							Labels: map[string]string{"job-type": "backup"},
						},
						Spec: v1.PodSpec{
							Containers: []v1.Container{
								{Image: "backup-tool:v2"},
							},
						},
					},
				},
			},
		},
	}

	_, err := clientset.BatchV1().CronJobs("default").Create(
		context.Background(), cj, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create cronjob: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("GetCronJobs failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 cronjob, got %d", len(result))
	}

	c := result[0]
	if c.Name != "daily-backup" {
		t.Errorf("expected name 'daily-backup', got %q", c.Name)
	}
	if c.Namespace != "default" {
		t.Errorf("expected namespace 'default', got %q", c.Namespace)
	}
	if c.Schedule != "0 2 * * *" {
		t.Errorf("expected schedule '0 2 * * *', got %q", c.Schedule)
	}
	if c.Suspend != false {
		t.Errorf("expected suspend false, got %v", c.Suspend)
	}
	if c.Image != "backup-tool:v2" {
		t.Errorf("expected image 'backup-tool:v2', got %q", c.Image)
	}
	// Labels should include both cronjob and template labels
	if c.Labels["app"] != "backup" {
		t.Errorf("expected label app=backup, got %q", c.Labels["app"])
	}
	if c.Labels["env"] != "prod" {
		t.Errorf("expected label env=prod, got %q", c.Labels["env"])
	}
	if c.Labels["job-type"] != "backup" {
		t.Errorf("expected label job-type=backup, got %q", c.Labels["job-type"])
	}
}

func TestGetCronJobs_SuspendedJob(t *testing.T) {
	boolPtr := func(b bool) *bool { return &b }

	clientset := fake.NewSimpleClientset()
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "suspended-job",
			Namespace: "default",
		},
		Spec: batchv1.CronJobSpec{
			Schedule: "0 0 * * *",
			Suspend:  boolPtr(true),
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: v1.PodTemplateSpec{
						Spec: v1.PodSpec{
							Containers: []v1.Container{{Image: "job:v1"}},
						},
					},
				},
			},
		},
	}

	_, err := clientset.BatchV1().CronJobs("default").Create(
		context.Background(), cj, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create cronjob: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("GetCronJobs failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 cronjob, got %d", len(result))
	}

	if !result[0].Suspend {
		t.Error("expected suspend to be true")
	}
	if result[0].NextRun != "Suspended" {
		t.Errorf("expected NextRun 'Suspended', got %q", result[0].NextRun)
	}
}

func TestGetCronJobs_NoContainers(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "no-containers",
			Namespace: "default",
		},
		Spec: batchv1.CronJobSpec{
			Schedule: "0 0 * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: v1.PodTemplateSpec{
						Spec: v1.PodSpec{
							Containers: []v1.Container{}, // no containers
						},
					},
				},
			},
		},
	}

	_, err := clientset.BatchV1().CronJobs("default").Create(
		context.Background(), cj, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create cronjob: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetCronJobs("default")
	if err != nil {
		t.Fatalf("GetCronJobs failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 cronjob, got %d", len(result))
	}

	if result[0].Image != "" {
		t.Errorf("expected empty image for no containers, got %q", result[0].Image)
	}
}
