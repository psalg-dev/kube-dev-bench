package app

import (
	"time"
)

// ResourcePollingConfig configures a resource polling loop.
// T is the type of resource info returned by the FetchFn.
type ResourcePollingConfig[T any] struct {
	// EventName is the name of the event to emit (e.g., "deployments:update")
	EventName string

	// FetchFn is the function to call to fetch resources for a given namespace
	FetchFn func(namespace string) ([]T, error)

	// Interval is the polling interval. Defaults to 5 seconds if not specified.
	Interval time.Duration
}

// StartAllPolling registers and starts all resource polling loops using the
// generic polling framework. MonitorPolling is excluded because it has different
// aggregation semantics (single MonitorInfo across all namespaces).
func (a *App) StartAllPolling() {
	a.pollingMu.Lock()
	if a.pollingStarted {
		a.pollingMu.Unlock()
		return
	}
	a.pollingStopCh = make(chan struct{})
	a.pollingStarted = true
	a.pollingMu.Unlock()

	startResourcePolling(a, ResourcePollingConfig[PodInfo]{
		EventName: EventPodsUpdate,
		FetchFn:   a.GetRunningPods,
	})
	startResourcePolling(a, ResourcePollingConfig[DeploymentInfo]{
		EventName: EventDeploymentsUpdate,
		FetchFn:   a.GetDeployments,
	})
	startResourcePolling(a, ResourcePollingConfig[CronJobInfo]{
		EventName: EventCronJobsUpdate,
		FetchFn:   a.GetCronJobs,
	})
	startResourcePolling(a, ResourcePollingConfig[DaemonSetInfo]{
		EventName: EventDaemonSetsUpdate,
		FetchFn:   a.GetDaemonSets,
	})
	startResourcePolling(a, ResourcePollingConfig[StatefulSetInfo]{
		EventName: EventStatefulSetsUpdate,
		FetchFn:   a.GetStatefulSets,
	})
	startResourcePolling(a, ResourcePollingConfig[ReplicaSetInfo]{
		EventName: EventReplicaSetsUpdate,
		FetchFn:   a.GetReplicaSets,
	})
	startResourcePolling(a, ResourcePollingConfig[HelmReleaseInfo]{
		EventName: EventHelmReleasesUpdate,
		FetchFn:   a.GetHelmReleases,
	})
	a.StartRBACPolling()

	// Monitor uses a custom loop (5s interval, aggregates across all namespaces
	// into a single MonitorInfo instead of a flat list), so it remains separate.
	a.StartMonitorPolling()
}

func (a *App) StopAllPolling() {
	a.pollingMu.Lock()
	defer a.pollingMu.Unlock()
	if !a.pollingStarted {
		return
	}
	if a.pollingStopCh != nil {
		close(a.pollingStopCh)
	}
	a.pollingStopCh = nil
	a.pollingStarted = false
}

// startResourcePolling starts a generic polling loop for any K8s resource type.
// It polls the configured namespaces periodically and emits events with the collected resources.
func startResourcePolling[T any](a *App, config ResourcePollingConfig[T]) {
	interval := config.Interval
	if interval == 0 {
		interval = 5 * time.Second
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
			case <-a.pollingStopCh:
				return
			}
			if a.ctx == nil {
				continue
			}

			nsList := a.getPollingNamespaces()
			if len(nsList) == 0 {
				continue
			}

			var all []T
			for _, ns := range nsList {
				items, err := config.FetchFn(ns)
				if err != nil {
					continue
				}
				all = append(all, items...)
			}

			emitEvent(a.ctx, config.EventName, all)
		}
	}()
}
