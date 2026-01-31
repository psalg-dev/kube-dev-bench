package app

import (
	"time"

	"github.com/robfig/cron/v3"
	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// getCronJobImage extracts the first container image from a cronjob
func getCronJobImage(cj *batchv1.CronJob) string {
	containers := cj.Spec.JobTemplate.Spec.Template.Spec.Containers
	if len(containers) > 0 {
		return containers[0].Image
	}
	return ""
}

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

// mergeCronJobLabels merges cronjob and template labels
func mergeCronJobLabels(cj *batchv1.CronJob) map[string]string {
	labels := make(map[string]string)
	for k, v := range cj.Labels {
		labels[k] = v
	}
	if tmpl := cj.Spec.JobTemplate.Spec.Template; tmpl.Labels != nil {
		for k, v := range tmpl.Labels {
			if _, exists := labels[k]; !exists {
				labels[k] = v
			}
		}
	}
	return labels
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
		Image:     getCronJobImage(&cj),
		NextRun:   getCronJobNextRun(&cj, now),
		Labels:    mergeCronJobLabels(&cj),
	}
}

// GetCronJobs returns all cronjobs in a namespace
func (a *App) GetCronJobs(namespace string) ([]CronJobInfo, error) {
	clientset, err := a.getClient()
	if err != nil {
		return nil, err
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
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			if nsList := a.getPollingNamespaces(); len(nsList) > 0 {
				all := a.collectCronJobs(nsList)
				emitEvent(a.ctx, "cronjobs:update", all)
			}
		}
	}()
}

func (a *App) collectCronJobs(nsList []string) []CronJobInfo {
	var all []CronJobInfo
	for _, ns := range nsList {
		if cjs, err := a.GetCronJobs(ns); err == nil {
			all = append(all, cjs...)
		}
	}
	return all
}
