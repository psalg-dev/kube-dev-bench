package app

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetJobs returns all jobs in a namespace
func (a *App) GetJobs(namespace string) ([]JobInfo, error) {
	configPath := a.getKubeConfigPath()
	config, err := clientcmd.LoadFromFile(configPath)
	if err != nil {
		return nil, err
	}
	if a.currentKubeContext == "" {
		return nil, fmt.Errorf("Kein Kontext gewählt")
	}
	clientConfig := clientcmd.NewNonInteractiveClientConfig(*config, a.currentKubeContext, &clientcmd.ConfigOverrides{}, nil)
	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
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
			dur := now.Sub(job.CreationTimestamp.Time)
			age = formatDuration(dur)
		}

		// Get the first container image from the job spec
		image := ""
		if len(job.Spec.Template.Spec.Containers) > 0 {
			image = job.Spec.Template.Spec.Containers[0].Image
		}

		// Calculate completion info
		completions := int32(1) // default if not specified
		if job.Spec.Completions != nil {
			completions = *job.Spec.Completions
		}

		// Calculate duration
		duration := "-"
		if job.Status.StartTime != nil {
			if job.Status.CompletionTime != nil {
				// Job completed
				dur := job.Status.CompletionTime.Sub(job.Status.StartTime.Time)
				duration = formatDuration(dur)
			} else {
				// Job still running
				dur := now.Sub(job.Status.StartTime.Time)
				duration = formatDuration(dur) + " (running)"
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
