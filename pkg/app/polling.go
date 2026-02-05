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

	// Interval is the polling interval. Defaults to 1 second if not specified.
	Interval time.Duration
}

// startResourcePolling starts a generic polling loop for any K8s resource type.
// It polls the configured namespaces periodically and emits events with the collected resources.
func startResourcePolling[T any](a *App, config ResourcePollingConfig[T]) {
	interval := config.Interval
	if interval == 0 {
		interval = time.Second
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			<-ticker.C
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
