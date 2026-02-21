package app

import (
	"time"

	"github.com/robfig/cron/v3"
	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
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
func buildCronJobInfo(cj *batchv1.CronJob, now time.Time) CronJobInfo {
	suspend := cj.Spec.Suspend != nil && *cj.Spec.Suspend

	return CronJobInfo{
		Name:      cj.Name,
		Namespace: cj.Namespace,
		Schedule:  cj.Spec.Schedule,
		Suspend:   suspend,
		Age:       FormatAge(cj.CreationTimestamp, now),
		Image:     ExtractFirstContainerImage(cj.Spec.JobTemplate.Spec.Template.Spec),
		NextRun:   getCronJobNextRun(cj, now),
		Labels:    MergeLabels(cj.Labels, cj.Spec.JobTemplate.Spec.Template.Labels),
	}
}

// GetCronJobs returns all cronjobs in a namespace
func (a *App) GetCronJobs(namespace string) ([]CronJobInfo, error) {
	if factory, ok := a.getInformerNamespaceFactory(namespace); ok {
		items, err := factory.Batch().V1().CronJobs().Lister().CronJobs(namespace).List(labels.Everything())
		if err == nil {
			now := time.Now()
			result := make([]CronJobInfo, 0, len(items))
			for _, item := range items {
				result = append(result, buildCronJobInfo(item, now))
			}
			return result, nil
		}
	}

	return listResources(a, namespace,
		func(cs kubernetes.Interface, ns string, opts metav1.ListOptions) ([]batchv1.CronJob, error) {
			list, err := cs.BatchV1().CronJobs(ns).List(a.ctx, opts)
			if err != nil {
				return nil, err
			}
			return list.Items, nil
		},
		buildCronJobInfo,
	)
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
