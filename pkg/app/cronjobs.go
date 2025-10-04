package app

import (
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetCronJobs returns all cronjobs in a namespace
func (a *App) GetCronJobs(namespace string) ([]CronJobInfo, error) {
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

	list, err := clientset.BatchV1().CronJobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []CronJobInfo
	now := time.Now()

	for _, cj := range list.Items {
		age := "-"
		if cj.CreationTimestamp.Time != (time.Time{}) {
			dur := now.Sub(cj.CreationTimestamp.Time)
			age = formatDuration(dur)
		}
		// First container image in job template (if any)
		image := ""
		if cj.Spec.JobTemplate.Spec.Template.Spec.Containers != nil && len(cj.Spec.JobTemplate.Spec.Template.Spec.Containers) > 0 {
			image = cj.Spec.JobTemplate.Spec.Template.Spec.Containers[0].Image
		}
		suspend := false
		if cj.Spec.Suspend != nil {
			suspend = *cj.Spec.Suspend
		}
		nextRun := "-"
		if !suspend && cj.Spec.Schedule != "" {
			nextRun = computeNextRunString(cj.Spec.Schedule, now)
		} else if suspend {
			nextRun = "Suspended"
		}
		labels := map[string]string{}
		for k, v := range cj.Labels {
			labels[k] = v
		}
		if tmpl := cj.Spec.JobTemplate.Spec.Template; tmpl.Labels != nil {
			for k, v := range tmpl.Labels {
				if _, e := labels[k]; !e {
					labels[k] = v
				}
			}
		}
		result = append(result, CronJobInfo{
			Name:      cj.Name,
			Namespace: cj.Namespace,
			Schedule:  cj.Spec.Schedule,
			Suspend:   suspend,
			Age:       age,
			Image:     image,
			NextRun:   nextRun,
			Labels:    labels,
		})
	}

	return result, nil
}

// computeNextRunString parses a standard 5-field cron schedule and returns the next occurrence as a formatted string.
func computeNextRunString(schedule string, base time.Time) string {
	// Kubernetes cron does not use seconds by default. Parse 5-field spec.
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	spec, err := parser.Parse(schedule)
	if err != nil {
		return "-"
	}
	next := spec.Next(base)
	return next.Local().Format("2006-01-02 15:04")
}

// StartCronJobPolling emits cronjobs:update events periodically with the current cronjob list
func (a *App) StartCronJobPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			nsList := a.preferredNamespaces
			if len(nsList) == 0 && a.currentNamespace != "" {
				nsList = []string{a.currentNamespace}
			}
			if len(nsList) == 0 {
				continue
			}
			var all []CronJobInfo
			for _, ns := range nsList {
				cjs, err := a.GetCronJobs(ns)
				if err != nil {
					continue
				}
				all = append(all, cjs...)
			}
			wailsRuntime.EventsEmit(a.ctx, "cronjobs:update", all)
		}
	}()
}
