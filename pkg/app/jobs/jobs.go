package jobs

import (
	"fmt"
	"time"

	"context"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// ResourceClient interface for dependency injection/testing
// Only relevant methods for resource actions are included

type ResourceClient interface {
	BatchV1() BatchV1Interface
}

type BatchV1Interface interface {
	Jobs(namespace string) JobInterface
	CronJobs(namespace string) CronJobInterface
}

type JobInterface interface {
	List(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error)
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error)
	Create(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error)
	Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

type CronJobInterface interface {
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error)
	Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error)
	Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

// JobInfo mirrors app.JobInfo but kept local to avoid import cycles
type JobInfo struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Completions int32             `json:"completions"`
	Succeeded   int32             `json:"succeeded"`
	Active      int32             `json:"active"`
	Failed      int32             `json:"failed"`
	Age         string            `json:"age"`
	Image       string            `json:"image"`
	Duration    string            `json:"duration"`
	Labels      map[string]string `json:"labels"`
}

// getJobImage returns the first container image from the job spec
func getJobImage(job *batchv1.Job) string {
	if len(job.Spec.Template.Spec.Containers) > 0 {
		return job.Spec.Template.Spec.Containers[0].Image
	}
	return ""
}

// getJobCompletions returns the target number of completions
func getJobCompletions(job *batchv1.Job) int32 {
	if job.Spec.Completions != nil {
		return *job.Spec.Completions
	}
	return 1
}

// getJobDuration calculates the job duration string
func getJobDuration(job *batchv1.Job, now time.Time) string {
	if job.Status.StartTime == nil {
		return "-"
	}
	if job.Status.CompletionTime != nil {
		return formatDuration(job.Status.CompletionTime.Sub(job.Status.StartTime.Time))
	}
	return formatDuration(now.Sub(job.Status.StartTime.Time)) + " (running)"
}

// mergeJobLabels merges job and template labels
func mergeJobLabels(job *batchv1.Job) map[string]string {
	labels := make(map[string]string)
	for k, v := range job.Labels {
		labels[k] = v
	}
	if job.Spec.Template.Labels != nil {
		for k, v := range job.Spec.Template.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}
	return labels
}

// buildJobInfo constructs a JobInfo from a Job
func buildJobInfo(job *batchv1.Job, now time.Time) JobInfo {
	age := "-"
	if !job.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(job.CreationTimestamp.Time))
	}

	return JobInfo{
		Name:        job.Name,
		Namespace:   job.Namespace,
		Completions: getJobCompletions(job),
		Succeeded:   job.Status.Succeeded,
		Active:      job.Status.Active,
		Failed:      job.Status.Failed,
		Age:         age,
		Image:       getJobImage(job),
		Duration:    getJobDuration(job, now),
		Labels:      mergeJobLabels(job),
	}
}

// GetJobs returns all jobs in a namespace using the provided ResourceClient
func GetJobs(client ResourceClient, namespace string) ([]JobInfo, error) {
	jobsList, err := client.BatchV1().Jobs(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]JobInfo, 0, len(jobsList.Items))
	for _, job := range jobsList.Items {
		result = append(result, buildJobInfo(&job, now))
	}

	return result, nil
}

// formatDuration formats a duration into a human-readable string
func formatDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd", days)
	} else if hours > 0 {
		return fmt.Sprintf("%dh", hours)
	} else if minutes > 0 {
		return fmt.Sprintf("%dm", minutes)
	} else {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
}
