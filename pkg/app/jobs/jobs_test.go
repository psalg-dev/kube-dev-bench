package jobs

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// Test GetJobs happy path
func TestGetJobs_ReturnsJobInfo(t *testing.T) {
	now := time.Now()
	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "job1", Namespace: "default", CreationTimestamp: metav1.NewTime(now.Add(-2 * time.Hour))},
			Spec:       batchv1.JobSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{Image: "nginx:latest"}}}}},
			Status:     batchv1.JobStatus{Succeeded: 1, Active: 0, Failed: 0},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	j := out[0]
	if j.Name != "job1" {
		t.Errorf("unexpected name: %s", j.Name)
	}
	if j.Image != "nginx:latest" {
		t.Errorf("unexpected image: %s", j.Image)
	}
}

// Test StartJob success and failure
func TestStartJob_SuccessAndError(t *testing.T) {
	mockJobs := &mockJobInterface{
		getFunc: func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error) {
			return &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: name}, Spec: batchv1.JobSpec{}}, nil
		},
		createFunc: func(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
			if job.GenerateName == "j-manual-" || job.GenerateName == "myjob-manual-" {
				return job, nil
			}
			return nil, errors.New("create failed")
		},
	}
	client := &mockBatchV1{jobs: mockJobs}
	if err := StartJob(client, "default", "myjob"); err != nil {
		t.Errorf("expected success, got %v", err)
	}
	// simulate get error
	mockJobs.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error) {
		return nil, errors.New("get error")
	}
	if err := StartJob(client, "default", "myjob"); err == nil {
		t.Errorf("expected error, got nil")
	}
}

func TestSuspendResumeCronJob(t *testing.T) {
	mockCron := &mockCronJobInterface{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
			s := string(data)
			if s == `{"spec":{"suspend":true}}` || s == `{"spec":{"suspend":false}}` {
				return &batchv1.CronJob{}, nil
			}
			return nil, errors.New("unexpected patch")
		},
	}
	client := &mockBatchV1{cronJobs: mockCron}
	if err := SuspendCronJob(client, "default", "cj"); err != nil {
		t.Fatalf("expected success suspend, got %v", err)
	}
	if err := ResumeCronJob(client, "default", "cj"); err != nil {
		t.Fatalf("expected success resume, got %v", err)
	}
	// patch error
	mockCron.patchFunc = func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
		return nil, errors.New("patch error")
	}
	if err := SuspendCronJob(client, "default", "cj"); err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestStartJobFromCronJob(t *testing.T) {
	mockCron := &mockCronJobInterface{
		getFunc: func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error) {
			return &batchv1.CronJob{ObjectMeta: metav1.ObjectMeta{Name: name}, Spec: batchv1.CronJobSpec{JobTemplate: batchv1.JobTemplateSpec{Spec: batchv1.JobSpec{}}}}, nil
		},
	}
	mockJobs := &mockJobInterface{
		createFunc: func(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
			if job.GenerateName == "cj-manual-" {
				return job, nil
			}
			return nil, errors.New("create error")
		},
	}
	client := &mockBatchV1{jobs: mockJobs, cronJobs: mockCron}
	if err := StartJobFromCronJob(client, "default", "cj"); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	// get error
	mockCron.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error) {
		return nil, errors.New("get err")
	}
	if err := StartJobFromCronJob(client, "default", "cj"); err == nil {
		t.Fatalf("expected error on get, got nil")
	}
}

// Mocks used by tests (implement interfaces in jobs package)

type mockBatchV1 struct {
	jobs     JobInterface
	cronJobs CronJobInterface
}

func (m *mockBatchV1) Jobs(namespace string) JobInterface         { return m.jobs }
func (m *mockBatchV1) CronJobs(namespace string) CronJobInterface { return m.cronJobs }
func (m *mockBatchV1) BatchV1() BatchV1Interface                  { return m }

type mockJobInterface struct {
	listFunc   func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error)
	getFunc    func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error)
	createFunc func(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error)
	deleteFunc func(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

func (m *mockJobInterface) List(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
	if m.listFunc != nil {
		return m.listFunc(ctx, opts)
	}
	return &batchv1.JobList{Items: []batchv1.Job{}}, nil
}
func (m *mockJobInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, name, opts)
	}
	return nil, nil
}
func (m *mockJobInterface) Create(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, job, opts)
	}
	return nil, nil
}
func (m *mockJobInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, name, opts)
	}
	return nil
}

type mockCronJobInterface struct {
	getFunc    func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error)
	patchFunc  func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error)
	deleteFunc func(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

func (m *mockCronJobInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, name, opts)
	}
	return nil, nil
}
func (m *mockCronJobInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
	if m.patchFunc != nil {
		return m.patchFunc(ctx, name, pt, data, opts)
	}
	return nil, nil
}
func (m *mockCronJobInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, name, opts)
	}
	return nil
}

// ensure we didn't accidentally change the public JobInfo shape
func TestJobInfoShape(t *testing.T) {
	expected := []struct {
		Name string
		Type string
	}{
		{"Name", "string"},
		{"Namespace", "string"},
		{"Completions", "int32"},
		{"Succeeded", "int32"},
		{"Active", "int32"},
		{"Failed", "int32"},
		{"Age", "string"},
		{"Image", "string"},
		{"Duration", "string"},
		{"Labels", "map[string]string"},
	}
	rt := reflect.TypeOf(JobInfo{})
	if rt.Kind() != reflect.Struct {
		t.Fatalf("JobInfo is not a struct")
	}
	if rt.NumField() != len(expected) {
		t.Fatalf("JobInfo field count changed: expected %d got %d", len(expected), rt.NumField())
	}
	for i, exp := range expected {
		f := rt.Field(i)
		if f.Name != exp.Name {
			t.Fatalf("JobInfo field %d name mismatch: expected %s got %s", i, exp.Name, f.Name)
		}
		// compare type string
		typeStr := f.Type.String()
		if typeStr != exp.Type {
			t.Fatalf("JobInfo field %s type mismatch: expected %s got %s", f.Name, exp.Type, typeStr)
		}
	}
}

// Tests for formatDuration function
func TestFormatDuration_Days(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"1 day", 24 * time.Hour, "1d"},
		{"2 days", 48 * time.Hour, "2d"},
		{"7 days", 7 * 24 * time.Hour, "7d"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := formatDuration(tc.duration)
			if result != tc.expected {
				t.Errorf("formatDuration(%v) = %q, want %q", tc.duration, result, tc.expected)
			}
		})
	}
}

func TestFormatDuration_Hours(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"1 hour", time.Hour, "1h"},
		{"5 hours", 5 * time.Hour, "5h"},
		{"23 hours", 23 * time.Hour, "23h"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := formatDuration(tc.duration)
			if result != tc.expected {
				t.Errorf("formatDuration(%v) = %q, want %q", tc.duration, result, tc.expected)
			}
		})
	}
}

func TestFormatDuration_Minutes(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"1 minute", time.Minute, "1m"},
		{"30 minutes", 30 * time.Minute, "30m"},
		{"59 minutes", 59 * time.Minute, "59m"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := formatDuration(tc.duration)
			if result != tc.expected {
				t.Errorf("formatDuration(%v) = %q, want %q", tc.duration, result, tc.expected)
			}
		})
	}
}

func TestFormatDuration_Seconds(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"0 seconds", 0, "0s"},
		{"1 second", time.Second, "1s"},
		{"30 seconds", 30 * time.Second, "30s"},
		{"59 seconds", 59 * time.Second, "59s"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := formatDuration(tc.duration)
			if result != tc.expected {
				t.Errorf("formatDuration(%v) = %q, want %q", tc.duration, result, tc.expected)
			}
		})
	}
}

func TestFormatDuration_Negative(t *testing.T) {
	// Negative durations should be treated as 0
	result := formatDuration(-5 * time.Minute)
	if result != "0s" {
		t.Errorf("formatDuration(-5m) = %q, want %q", result, "0s")
	}
}

// Tests for GetJobs with various scenarios
func TestGetJobs_EmptyList(t *testing.T) {
	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return &batchv1.JobList{Items: []batchv1.Job{}}, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 0 {
		t.Errorf("expected 0 jobs, got %d", len(out))
	}
}

func TestGetJobs_ListError(t *testing.T) {
	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return nil, errors.New("list error")
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	_, err := GetJobs(client, "default")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetJobs_WithCompletions(t *testing.T) {
	completions := int32(3)
	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "job-with-completions", Namespace: "default"},
			Spec:       batchv1.JobSpec{Completions: &completions},
			Status:     batchv1.JobStatus{Succeeded: 2},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	if out[0].Completions != 3 {
		t.Errorf("expected completions 3, got %d", out[0].Completions)
	}
}

func TestGetJobs_WithDuration_Completed(t *testing.T) {
	now := time.Now()
	startTime := metav1.NewTime(now.Add(-10 * time.Minute))
	completionTime := metav1.NewTime(now.Add(-5 * time.Minute))

	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "completed-job", Namespace: "default"},
			Spec:       batchv1.JobSpec{},
			Status: batchv1.JobStatus{
				StartTime:      &startTime,
				CompletionTime: &completionTime,
				Succeeded:      1,
			},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	// Duration should be 5 minutes
	if out[0].Duration != "5m" {
		t.Errorf("expected duration '5m', got %q", out[0].Duration)
	}
}

func TestGetJobs_WithDuration_Running(t *testing.T) {
	now := time.Now()
	startTime := metav1.NewTime(now.Add(-3 * time.Minute))

	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "running-job", Namespace: "default"},
			Spec:       batchv1.JobSpec{},
			Status: batchv1.JobStatus{
				StartTime: &startTime,
				Active:    1,
			},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	// Duration should indicate running
	if out[0].Duration == "-" {
		t.Error("expected running duration, got '-'")
	}
}

func TestGetJobs_WithLabels(t *testing.T) {
	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "labeled-job",
				Namespace: "default",
				Labels:    map[string]string{"app": "test", "env": "dev"},
			},
			Spec: batchv1.JobSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"pod-label": "value"},
					},
				},
			},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	if out[0].Labels["app"] != "test" {
		t.Errorf("expected label app=test, got %v", out[0].Labels)
	}
	if out[0].Labels["pod-label"] != "value" {
		t.Errorf("expected pod-label=value, got %v", out[0].Labels)
	}
}

func TestGetJobs_NoStartTime(t *testing.T) {
	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "pending-job", Namespace: "default"},
			Spec:       batchv1.JobSpec{},
			Status:     batchv1.JobStatus{},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	if out[0].Duration != "-" {
		t.Errorf("expected duration '-' for job without start time, got %q", out[0].Duration)
	}
}

func TestGetJobs_NoContainers(t *testing.T) {
	jl := &batchv1.JobList{Items: []batchv1.Job{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "no-container-job", Namespace: "default"},
			Spec:       batchv1.JobSpec{Template: corev1.PodTemplateSpec{}},
		},
	}}

	mockJobs := &mockJobInterface{
		listFunc: func(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
			return jl, nil
		},
	}
	client := &mockBatchV1{jobs: mockJobs}

	out, err := GetJobs(client, "default")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 job, got %d", len(out))
	}
	if out[0].Image != "" {
		t.Errorf("expected empty image, got %q", out[0].Image)
	}
}
