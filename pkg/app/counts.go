package app

import (
	"time"
)

// runResourceCountsAggregator periodically polls the cluster for the selected namespaces
// and emits a consolidated snapshot over the Wails event bus.
func (a *App) runResourceCountsAggregator() {
	fullTicker := time.NewTicker(4 * time.Second)
	podsTicker := time.NewTicker(1 * time.Second) // faster pod status updates
	defer fullTicker.Stop()
	defer podsTicker.Stop()
	// Initial immediate attempt
	a.refreshResourceCounts()
	for {
		select {
		case <-a.ctx.Done():
			return
		case <-fullTicker.C:
			a.refreshResourceCounts()
		case <-podsTicker.C:
			a.refreshPodStatusOnly()
		case <-a.countsRefreshCh:
			a.refreshResourceCounts()
		}
	}
}

// refreshPodStatusOnly recomputes only pod status counts and emits an update
// if pod status changed (keeping other cached counts the same).
func (a *App) refreshPodStatusOnly() {
	if a.ctx == nil || a.currentKubeContext == "" {
		return
	}
	nsList := append([]string(nil), a.preferredNamespaces...)
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	if len(nsList) == 0 {
		return
	}

	var podAgg PodStatusCounts
	for _, ns := range nsList {
		if ns == "" {
			continue
		}
		if pcs, err := a.GetPodStatusCounts(ns); err == nil {
			podAgg.Running += pcs.Running
			podAgg.Pending += pcs.Pending
			podAgg.Failed += pcs.Failed
			podAgg.Succeeded += pcs.Succeeded
			podAgg.Unknown += pcs.Unknown
			podAgg.Total += pcs.Total
		}
	}

	a.resourceCountsMu.RLock()
	last := a.lastResourceCounts
	a.resourceCountsMu.RUnlock()
	if last.PodStatus == podAgg { // no change
		return
	}
	// Update snapshot
	last.PodStatus = podAgg
	a.resourceCountsMu.Lock()
	a.lastResourceCounts = last
	a.resourceCountsMu.Unlock()
	emitEvent(a.ctx, "resourcecounts:update", last)
}

// refreshResourceCounts computes counts and emits an event if anything changed.
func (a *App) refreshResourceCounts() {
	if a.ctx == nil {
		return
	}
	if a.currentKubeContext == "" {
		return
	}

	// Snapshot namespaces (avoid holding lock during I/O)
	nsList := append([]string(nil), a.preferredNamespaces...)
	if len(nsList) == 0 && a.currentNamespace != "" { // legacy single-namespace path
		nsList = []string{a.currentNamespace}
	}
	if len(nsList) == 0 {
		return
	}

	// Aggregate counts
	var agg ResourceCounts
	// Pod status counts aggregated across namespaces
	for _, ns := range nsList {
		if ns == "" {
			continue
		}
		if pcs, err := a.GetPodStatusCounts(ns); err == nil {
			agg.PodStatus.Running += pcs.Running
			agg.PodStatus.Pending += pcs.Pending
			agg.PodStatus.Failed += pcs.Failed
			agg.PodStatus.Succeeded += pcs.Succeeded
			agg.PodStatus.Unknown += pcs.Unknown
			agg.PodStatus.Total += pcs.Total
		}
		if deps, err := a.GetDeployments(ns); err == nil {
			agg.Deployments += len(deps)
		}
		if svcs, err := a.GetServices(ns); err == nil {
			agg.Services += len(svcs)
		}
		if jobs, err := a.GetJobs(ns); err == nil {
			agg.Jobs += len(jobs)
		}
		if cjs, err := a.GetCronJobs(ns); err == nil {
			agg.CronJobs += len(cjs)
		}
		if dss, err := a.GetDaemonSets(ns); err == nil {
			agg.DaemonSets += len(dss)
		}
		if sss, err := a.GetStatefulSets(ns); err == nil {
			agg.StatefulSets += len(sss)
		}
		if rss, err := a.GetReplicaSets(ns); err == nil {
			agg.ReplicaSets += len(rss)
		}
		if cms, err := a.GetConfigMaps(ns); err == nil {
			agg.ConfigMaps += len(cms)
		}
		if secs, err := a.GetSecrets(ns); err == nil {
			agg.Secrets += len(secs)
		}
		if ings, err := a.GetIngresses(ns); err == nil {
			agg.Ingresses += len(ings)
		}
		if pvcs, err := a.GetPersistentVolumeClaims(ns); err == nil {
			agg.PersistentVolumeClaims += len(pvcs)
		}
		if helmReleases, err := a.GetHelmReleases(ns); err == nil {
			agg.HelmReleases += len(helmReleases)
		}
	}
	if pvs, err := a.GetPersistentVolumes(); err == nil {
		agg.PersistentVolumes = len(pvs)
	}

	// Compare with last snapshot
	a.resourceCountsMu.RLock()
	last := a.lastResourceCounts
	a.resourceCountsMu.RUnlock()
	if resourceCountsEqual(last, agg) {
		return // no change
	}
	a.resourceCountsMu.Lock()
	a.lastResourceCounts = agg
	a.resourceCountsMu.Unlock()

	emitEvent(a.ctx, "resourcecounts:update", agg)
}

// resourceCountsEqual shallow comparison including embedded pod status counts.
func resourceCountsEqual(aCnt, bCnt ResourceCounts) bool {
	if aCnt.PodStatus != bCnt.PodStatus {
		return false
	}
	return aCnt.Deployments == bCnt.Deployments &&
		aCnt.Services == bCnt.Services &&
		aCnt.Jobs == bCnt.Jobs &&
		aCnt.CronJobs == bCnt.CronJobs &&
		aCnt.DaemonSets == bCnt.DaemonSets &&
		aCnt.StatefulSets == bCnt.StatefulSets &&
		aCnt.ReplicaSets == bCnt.ReplicaSets &&
		aCnt.ConfigMaps == bCnt.ConfigMaps &&
		aCnt.Secrets == bCnt.Secrets &&
		aCnt.Ingresses == bCnt.Ingresses &&
		aCnt.PersistentVolumeClaims == bCnt.PersistentVolumeClaims &&
		aCnt.PersistentVolumes == bCnt.PersistentVolumes &&
		aCnt.HelmReleases == bCnt.HelmReleases
}

// GetResourceCounts returns the latest cached snapshot (no recomputation).
func (a *App) GetResourceCounts() ResourceCounts {
	a.resourceCountsMu.RLock()
	defer a.resourceCountsMu.RUnlock()
	return a.lastResourceCounts
}
