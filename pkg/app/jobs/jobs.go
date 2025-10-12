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

// GetJobs returns all jobs in a namespace using the provided ResourceClient
func GetJobs(client ResourceClient, namespace string) ([]JobInfo, error) {
	jobsList, err := client.BatchV1().Jobs(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []JobInfo
	now := time.Now()

	for _, job := range jobsList.Items {
		age := "-"
		if job.CreationTimestamp.Time != (time.Time{}) {
			age = formatDuration(now.Sub(job.CreationTimestamp.Time))
		}

		image := ""
		if len(job.Spec.Template.Spec.Containers) > 0 {
			image = job.Spec.Template.Spec.Containers[0].Image
		}

		completions := int32(1)
		if job.Spec.Completions != nil {
			completions = *job.Spec.Completions
		}

		duration := "-"
		if job.Status.StartTime != nil {
			if job.Status.CompletionTime != nil {
				// Job completed
				duration = formatDuration(job.Status.CompletionTime.Sub(job.Status.StartTime.Time))
			} else {
				// Job still running
				duration = formatDuration(now.Sub(job.Status.StartTime.Time)) + " (running)"
			}
		}

		labels := map[string]string{}
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

		jobInfo := JobInfo{
			Name:        job.Name,
			Namespace:   job.Namespace,
			Completions: completions,
			Succeeded:   job.Status.Succeeded,
			Active:      job.Status.Active,
			Failed:      job.Status.Failed,
			Age:         age,
			Image:       image,
			Duration:    duration,
			Labels:      labels,
		}

		result = append(result, jobInfo)
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
