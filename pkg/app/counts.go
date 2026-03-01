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
	emitEvent(a.ctx, EventResourceEventsUpdate, map[string]string{"source": "counts:init"})
	for {
		select {
		case <-a.ctx.Done():
			return
		case <-fullTicker.C:
			if !a.useInformers {
				a.refreshResourceCounts()
				emitEvent(a.ctx, EventResourceEventsUpdate, map[string]string{"source": "counts:full"})
			}
		case <-podsTicker.C:
			if !a.useInformers {
				a.refreshPodStatusOnly()
			}
		case <-a.countsRefreshCh:
			a.refreshResourceCounts()
			emitEvent(a.ctx, EventResourceEventsUpdate, map[string]string{"source": "counts:refresh"})
		}
	}
}

func (a *App) requestCountsRefresh() {
	select {
	case a.countsRefreshCh <- struct{}{}:
	default:
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
	emitEvent(a.ctx, EventResourceCountsUpdate, last)
}

// getRefreshNamespaces returns the list of namespaces to count
func (a *App) getRefreshNamespaces() []string {
	nsList := append([]string(nil), a.preferredNamespaces...)
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	return nsList
}

// aggregatePodCounts adds pod status counts from a namespace to the aggregate
func (a *App) aggregatePodCounts(ns string, agg *ResourceCounts) {
	if pcs, err := a.GetPodStatusCounts(ns); err == nil {
		agg.PodStatus.Running += pcs.Running
		agg.PodStatus.Pending += pcs.Pending
		agg.PodStatus.Failed += pcs.Failed
		agg.PodStatus.Succeeded += pcs.Succeeded
		agg.PodStatus.Unknown += pcs.Unknown
		agg.PodStatus.Total += pcs.Total
	}
}

// aggregateResourceCounts adds counts for all resource types from a namespace
func (a *App) aggregateResourceCounts(ns string, agg *ResourceCounts) {
	a.aggregatePodCounts(ns, agg)
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

	if roles, err := a.GetRoles(ns); err == nil {
		agg.Roles += len(roles)
	}
	if rbs, err := a.GetRoleBindings(ns); err == nil {
		agg.RoleBindings += len(rbs)
	}
}

// aggregateClusterWideCounts adds cluster-wide resource counts
func (a *App) aggregateClusterWideCounts(agg *ResourceCounts) {
	if pvs, err := a.GetPersistentVolumes(); err == nil {
		agg.PersistentVolumes = len(pvs)
	}
	if crs, err := a.GetClusterRoles(); err == nil {
		agg.ClusterRoles = len(crs)
	}
	if crbs, err := a.GetClusterRoleBindings(); err == nil {
		agg.ClusterRoleBindings = len(crbs)
	}
}

// getRefreshNamespaces returns the list of namespaces to count
func (a *App) getRefreshNamespaces() []string {
	nsList := append([]string(nil), a.preferredNamespaces...)
	if len(nsList) == 0 && a.currentNamespace != "" {
		nsList = []string{a.currentNamespace}
	}
	return nsList
}

// aggregatePodCounts adds pod status counts from a namespace to the aggregate
func (a *App) aggregatePodCounts(ns string, agg *ResourceCounts) {
	if pcs, err := a.GetPodStatusCounts(ns); err == nil {
		agg.PodStatus.Running += pcs.Running
		agg.PodStatus.Pending += pcs.Pending
		agg.PodStatus.Failed += pcs.Failed
		agg.PodStatus.Succeeded += pcs.Succeeded
		agg.PodStatus.Unknown += pcs.Unknown
		agg.PodStatus.Total += pcs.Total
	}
}

// aggregateResourceCounts adds counts for all resource types from a namespace
func (a *App) aggregateResourceCounts(ns string, agg *ResourceCounts) {
	a.aggregatePodCounts(ns, agg)
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

// aggregateClusterWideCounts adds cluster-wide resource counts
func (a *App) aggregateClusterWideCounts(agg *ResourceCounts) {
	if pvs, err := a.GetPersistentVolumes(); err == nil {
		agg.PersistentVolumes = len(pvs)
	}
}

// refreshResourceCounts computes counts and emits an event if anything changed.
func (a *App) refreshResourceCounts() {
	if a.ctx == nil || a.currentKubeContext == "" {
		return
	}

	nsList := a.getRefreshNamespaces()
	if len(nsList) == 0 {
		return
	}

	var agg ResourceCounts
	for _, ns := range nsList {
		if ns != "" {
			a.aggregateResourceCounts(ns, &agg)
		}
	}
	a.aggregateClusterWideCounts(&agg)

	// Compare with last snapshot
	a.resourceCountsMu.RLock()
	last := a.lastResourceCounts
	a.resourceCountsMu.RUnlock()
	if resourceCountsEqual(last, agg) {
		return
	}
	a.resourceCountsMu.Lock()
	a.lastResourceCounts = agg
	a.resourceCountsMu.Unlock()

	emitEvent(a.ctx, EventResourceCountsUpdate, agg)
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
		aCnt.HelmReleases == bCnt.HelmReleases &&
		aCnt.Roles == bCnt.Roles &&
		aCnt.ClusterRoles == bCnt.ClusterRoles &&
		aCnt.RoleBindings == bCnt.RoleBindings &&
		aCnt.ClusterRoleBindings == bCnt.ClusterRoleBindings
}

// GetResourceCounts returns the latest cached snapshot (no recomputation).
func (a *App) GetResourceCounts() ResourceCounts {
	a.resourceCountsMu.RLock()
	defer a.resourceCountsMu.RUnlock()
	return a.lastResourceCounts
}
