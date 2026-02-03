package app

import (
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// getCronJobNextRun calculates the next run time string
func getCronJobNextRun(cj *batchv1.CronJob, now time.Time) string {
	suspend := cj.Spec.Suspend != nil && *cj.Spec.Suspend
	if suspend {
		return "Suspended"
	}
	if cj.Spec.Schedule != "" {
		return computeNextRunString(cj.Spec.Schedule, now)
	}
	return "-"
}

// buildCronJobInfo creates a CronJobInfo from a cronjob resource
func buildCronJobInfo(cj batchv1.CronJob, now time.Time) CronJobInfo {
	age := "-"
	if cj.CreationTimestamp.Time != (time.Time{}) {
		age = formatDuration(now.Sub(cj.CreationTimestamp.Time))
	}

	suspend := cj.Spec.Suspend != nil && *cj.Spec.Suspend

	return CronJobInfo{
		Name:      cj.Name,
		Namespace: cj.Namespace,
		Schedule:  cj.Spec.Schedule,
		Suspend:   suspend,
		Age:       age,
		Image:     ExtractFirstContainerImage(cj.Spec.JobTemplate.Spec.Template.Spec),
		NextRun:   getCronJobNextRun(&cj, now),
		Labels:    MergeLabels(SafeLabels(cj.Labels), SafeLabels(cj.Spec.JobTemplate.Spec.Template.Labels)),
	}
}

// GetCronJobs returns all cronjobs in a namespace
func (a *App) GetCronJobs(namespace string) ([]CronJobInfo, error) {
	var clientset kubernetes.Interface
	var err error

	if a.testClientset != nil {
		clientset = a.testClientset.(kubernetes.Interface)
	} else {
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
		clientset, err = kubernetes.NewForConfig(restConfig)
		if err != nil {
			return nil, err
		}
	}

	list, err := clientset.BatchV1().CronJobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]CronJobInfo, 0, len(list.Items))
	for _, cj := range list.Items {
		result = append(result, buildCronJobInfo(cj, now))
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

// computeNextRuns parses a standard 5-field cron schedule and returns the next N occurrences.
// Times are returned in RFC3339 (local time) so the frontend can reliably parse them.
func computeNextRuns(schedule string, base time.Time, count int) []string {
	if count <= 0 {
		return []string{}
	}
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	spec, err := parser.Parse(schedule)
	if err != nil {
		return []string{}
	}
	out := make([]string, 0, count)
	t := base
	for i := 0; i < count; i++ {
		t = spec.Next(t)
		out = append(out, t.Local().Format(time.RFC3339))
	}
	return out
}

// StartCronJobPolling emits cronjobs:update events periodically with the current cronjob list
func (a *App) StartCronJobPolling() {
	startResourcePolling(a, ResourcePollingConfig[CronJobInfo]{
		EventName: "cronjobs:update",
		FetchFn:   a.GetCronJobs,
	})
}
