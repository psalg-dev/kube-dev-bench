package app

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetJobs returns all jobs in a namespace
func (a *App) GetJobs(namespace string) ([]JobInfo, error) {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return nil, err
	}
	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	var result []JobInfo
	now := time.Now()

	for _, job := range jobs.Items {
		age := "-"
		if job.CreationTimestamp.Time != (time.Time{}) {
			age = formatDuration(now.Sub(job.CreationTimestamp.Time))
		}

		image := ""
		if len(job.Spec.Template.Spec.Containers) > 0 {
			image = job.Spec.Template.Spec.Containers[0].Image
		}

		completions := int32(1) // default if not specified
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
