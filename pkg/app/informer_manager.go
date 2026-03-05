package app

import (
	"fmt"
	"sync"
	"time"

	"gowails/pkg/logger"

	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

const informerResyncPeriod = 10 * time.Minute

// maxInformerNamespaces caps the number of namespaces that use active Watch
// connections via SharedInformerFactories (SUG-2). Beyond this limit the
// namespaces are silently excluded from informer mode and fall back to
// polling-based list calls. Each watched namespace opens ~14 Watch streams,
// so capping at 10 keeps the total under 140 concurrent API connections.
const maxInformerNamespaces = 10

type informerSnapshotEmitter func() error

type InformerManager struct {
	app        *App
	clientset  kubernetes.Interface
	namespaces []string

	mu          sync.RWMutex
	started     bool
	stopCh      chan struct{}
	nsFactories map[string]informers.SharedInformerFactory
	clFactory   informers.SharedInformerFactory
	timers      map[string]*time.Timer

	errorMu    sync.Mutex
	errorState bool
}

func NewInformerManager(clientset kubernetes.Interface, namespaces []string, app *App) *InformerManager {
	normalized := normalizeNamespaces(namespaces)
	capped := normalized
	if len(normalized) > maxInformerNamespaces {
		capped = normalized[:maxInformerNamespaces]
		logger.Warn("informer namespace count exceeds cap; extra namespaces will use polling",
			"requested", len(normalized), "cap", maxInformerNamespaces,
			"polling", normalized[maxInformerNamespaces:])
		if app != nil && app.ctx != nil {
			emitEvent(app.ctx, "k8s:informer:ns-capped", map[string]interface{}{
				"cap":     maxInformerNamespaces,
				"total":   len(normalized),
				"polling": normalized[maxInformerNamespaces:],
			})
		}
	}
	return &InformerManager{
		app:        app,
		clientset:  clientset,
		namespaces: capped,
		timers:     make(map[string]*time.Timer),
	}
}

func normalizeNamespaces(namespaces []string) []string {
	if len(namespaces) == 0 {
		return nil
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		if ns == "" {
			continue
		}
		if _, ok := seen[ns]; ok {
			continue
		}
		seen[ns] = struct{}{}
		out = append(out, ns)
	}
	return out
}

func (im *InformerManager) Start() error {
	im.mu.Lock()
	if im.started {
		im.mu.Unlock()
		return nil
	}

	im.stopCh = make(chan struct{})
	im.nsFactories = make(map[string]informers.SharedInformerFactory)
	im.clFactory = informers.NewSharedInformerFactory(im.clientset, informerResyncPeriod)

	for _, ns := range im.namespaces {
		im.nsFactories[ns] = informers.NewSharedInformerFactoryWithOptions(
			im.clientset,
			informerResyncPeriod,
			informers.WithNamespace(ns),
		)
	}

	im.registerHandlersLocked()

	for _, factory := range im.nsFactories {
		factory.Start(im.stopCh)
	}
	im.clFactory.Start(im.stopCh)

	hasSynced := make([]cache.InformerSynced, 0, 32)
	for _, factory := range im.nsFactories {
		hasSynced = append(hasSynced,
			factory.Core().V1().Pods().Informer().HasSynced,
			factory.Core().V1().Services().Informer().HasSynced,
			factory.Core().V1().ConfigMaps().Informer().HasSynced,
			factory.Core().V1().Secrets().Informer().HasSynced,
			factory.Core().V1().PersistentVolumeClaims().Informer().HasSynced,
			factory.Apps().V1().Deployments().Informer().HasSynced,
			factory.Apps().V1().StatefulSets().Informer().HasSynced,
			factory.Apps().V1().DaemonSets().Informer().HasSynced,
			factory.Apps().V1().ReplicaSets().Informer().HasSynced,
			factory.Batch().V1().Jobs().Informer().HasSynced,
			factory.Batch().V1().CronJobs().Informer().HasSynced,
			factory.Networking().V1().Ingresses().Informer().HasSynced,
			factory.Rbac().V1().Roles().Informer().HasSynced,
			factory.Rbac().V1().RoleBindings().Informer().HasSynced,
		)
	}
	hasSynced = append(hasSynced,
		im.clFactory.Rbac().V1().ClusterRoles().Informer().HasSynced,
		im.clFactory.Rbac().V1().ClusterRoleBindings().Informer().HasSynced,
	)

	if len(hasSynced) > 0 && !cache.WaitForCacheSync(im.stopCh, hasSynced...) {
		close(im.stopCh)
		im.stopCh = nil
		im.nsFactories = nil
		im.clFactory = nil
		im.mu.Unlock()
		return fmt.Errorf("failed to sync informer caches")
	}

	im.started = true
	namespaces := append([]string(nil), im.namespaces...)
	im.mu.Unlock()

	emitEvent(im.app.ctx, "k8s:cache:synced", map[string]interface{}{"namespaces": namespaces})
	im.emitAllSnapshots()
	return nil
}

func (im *InformerManager) Stop() {
	im.mu.Lock()
	defer im.mu.Unlock()

	if !im.started && im.stopCh == nil {
		return
	}

	for key, timer := range im.timers {
		if timer != nil {
			timer.Stop()
		}
		delete(im.timers, key)
	}

	if im.stopCh != nil {
		close(im.stopCh)
	}
	im.stopCh = nil
	im.nsFactories = nil
	im.clFactory = nil
	im.started = false
}

func (im *InformerManager) Restart(namespaces []string) error {
	im.Stop()
	im.mu.Lock()
	im.namespaces = normalizeNamespaces(namespaces)
	im.mu.Unlock()
	return im.Start()
}

func (im *InformerManager) registerHandlersLocked() {
	for _, factory := range im.nsFactories {
		im.bindInformer(factory.Core().V1().Pods().Informer(), EventPodsUpdate, im.emitPodsSnapshot)
		im.bindInformer(factory.Core().V1().Services().Informer(), EventServicesUpdate, im.emitServicesSnapshot)
		im.bindInformer(factory.Core().V1().ConfigMaps().Informer(), EventConfigMapsUpdate, im.emitConfigMapsSnapshot)
		im.bindInformer(factory.Core().V1().Secrets().Informer(), EventSecretsUpdate, im.emitSecretsSnapshot)
		im.bindInformer(factory.Core().V1().PersistentVolumeClaims().Informer(), EventPVCsUpdate, im.emitPVCsSnapshot)

		im.bindInformer(factory.Apps().V1().Deployments().Informer(), EventDeploymentsUpdate, im.emitDeploymentsSnapshot)
		im.bindInformer(factory.Apps().V1().StatefulSets().Informer(), EventStatefulSetsUpdate, im.emitStatefulSetsSnapshot)
		im.bindInformer(factory.Apps().V1().DaemonSets().Informer(), EventDaemonSetsUpdate, im.emitDaemonSetsSnapshot)
		im.bindInformer(factory.Apps().V1().ReplicaSets().Informer(), EventReplicaSetsUpdate, im.emitReplicaSetsSnapshot)

		im.bindInformer(factory.Batch().V1().Jobs().Informer(), EventJobsUpdate, im.emitJobsSnapshot)
		im.bindInformer(factory.Batch().V1().CronJobs().Informer(), EventCronJobsUpdate, im.emitCronJobsSnapshot)

		im.bindInformer(factory.Networking().V1().Ingresses().Informer(), EventIngressesUpdate, im.emitIngressesSnapshot)

		im.bindInformer(factory.Rbac().V1().Roles().Informer(), EventRolesUpdate, im.emitRolesSnapshot)
		im.bindInformer(factory.Rbac().V1().RoleBindings().Informer(), EventRoleBindingsUpdate, im.emitRoleBindingsSnapshot)
	}

	im.bindInformer(im.clFactory.Rbac().V1().ClusterRoles().Informer(), EventClusterRolesUpdate, im.emitClusterRolesSnapshot)
	im.bindInformer(im.clFactory.Rbac().V1().ClusterRoleBindings().Informer(), EventClusterRoleBindingsUpdate, im.emitClusterRoleBindingsSnapshot)
}

func (im *InformerManager) bindInformer(inf cache.SharedIndexInformer, eventName string, emit informerSnapshotEmitter) {
	_ = inf.SetWatchErrorHandler(func(_ *cache.Reflector, err error) {
		im.errorMu.Lock()
		im.errorState = true
		im.errorMu.Unlock()
		emitEvent(im.app.ctx, "k8s:informer:error", map[string]string{
			"error":   err.Error(),
			"backoff": "5s",
		})
	})

	onChange := func() {
		im.errorMu.Lock()
		wasError := im.errorState
		im.errorState = false
		im.errorMu.Unlock()
		if wasError {
			emitEvent(im.app.ctx, "k8s:informer:reconnected", map[string]string{"status": "ok"})
		}
		im.scheduleSnapshot(eventName, emit)
	}

	_, _ = inf.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(_ interface{}) {
			onChange()
		},
		UpdateFunc: func(_, _ interface{}) {
			onChange()
		},
		DeleteFunc: func(_ interface{}) {
			onChange()
		},
	})
}

func (im *InformerManager) scheduleSnapshot(key string, emit informerSnapshotEmitter) {
	im.mu.Lock()
	defer im.mu.Unlock()

	if timer, ok := im.timers[key]; ok && timer != nil {
		timer.Stop()
	}
	im.timers[key] = time.AfterFunc(250*time.Millisecond, func() {
		_ = emit()
		im.app.requestCountsRefresh()
	})
}

func (im *InformerManager) selectedNamespaces() []string {
	im.mu.RLock()
	defer im.mu.RUnlock()
	out := make([]string, len(im.namespaces))
	copy(out, im.namespaces)
	return out
}

func (im *InformerManager) namespaceFactory(namespace string) (informers.SharedInformerFactory, bool) {
	im.mu.RLock()
	defer im.mu.RUnlock()
	if !im.started || im.nsFactories == nil {
		return nil, false
	}
	factory, ok := im.nsFactories[namespace]
	return factory, ok
}

func (im *InformerManager) emitAllSnapshots() {
	_ = im.emitPodsSnapshot()
	_ = im.emitDeploymentsSnapshot()
	_ = im.emitStatefulSetsSnapshot()
	_ = im.emitDaemonSetsSnapshot()
	_ = im.emitReplicaSetsSnapshot()
	_ = im.emitCronJobsSnapshot()
	_ = im.emitJobsSnapshot()
	_ = im.emitServicesSnapshot()
	_ = im.emitConfigMapsSnapshot()
	_ = im.emitSecretsSnapshot()
	_ = im.emitPVCsSnapshot()
	_ = im.emitIngressesSnapshot()
	_ = im.emitRolesSnapshot()
	_ = im.emitRoleBindingsSnapshot()
	_ = im.emitClusterRolesSnapshot()
	_ = im.emitClusterRoleBindingsSnapshot()
	im.app.requestCountsRefresh()
}

func emitAcrossNamespaces[T any](im *InformerManager, eventName string, fetch func(namespace string) ([]T, error)) error {
	all := make([]T, 0)
	for _, ns := range im.selectedNamespaces() {
		items, err := fetch(ns)
		if err != nil {
			continue
		}
		all = append(all, items...)
	}
	emitEvent(im.app.ctx, eventName, all)
	return nil
}

func (im *InformerManager) emitPodsSnapshot() error {
	return emitAcrossNamespaces(im, EventPodsUpdate, im.app.GetRunningPods)
}

func (im *InformerManager) emitDeploymentsSnapshot() error {
	return emitAcrossNamespaces(im, EventDeploymentsUpdate, im.app.GetDeployments)
}

func (im *InformerManager) emitStatefulSetsSnapshot() error {
	return emitAcrossNamespaces(im, EventStatefulSetsUpdate, im.app.GetStatefulSets)
}

func (im *InformerManager) emitDaemonSetsSnapshot() error {
	return emitAcrossNamespaces(im, EventDaemonSetsUpdate, im.app.GetDaemonSets)
}

func (im *InformerManager) emitReplicaSetsSnapshot() error {
	return emitAcrossNamespaces(im, EventReplicaSetsUpdate, im.app.GetReplicaSets)
}

func (im *InformerManager) emitCronJobsSnapshot() error {
	return emitAcrossNamespaces(im, EventCronJobsUpdate, im.app.GetCronJobs)
}

func (im *InformerManager) emitJobsSnapshot() error {
	return emitAcrossNamespaces(im, EventJobsUpdate, im.app.GetJobs)
}

func (im *InformerManager) emitServicesSnapshot() error {
	return emitAcrossNamespaces(im, EventServicesUpdate, im.app.GetServices)
}

func (im *InformerManager) emitConfigMapsSnapshot() error {
	return emitAcrossNamespaces(im, EventConfigMapsUpdate, im.app.GetConfigMaps)
}

func (im *InformerManager) emitSecretsSnapshot() error {
	return emitAcrossNamespaces(im, EventSecretsUpdate, im.app.GetSecrets)
}

func (im *InformerManager) emitPVCsSnapshot() error {
	return emitAcrossNamespaces(im, EventPVCsUpdate, im.app.GetPersistentVolumeClaims)
}

func (im *InformerManager) emitIngressesSnapshot() error {
	return emitAcrossNamespaces(im, EventIngressesUpdate, im.app.GetIngresses)
}

func (im *InformerManager) emitRolesSnapshot() error {
	return emitAcrossNamespaces(im, EventRolesUpdate, im.app.GetRoles)
}

func (im *InformerManager) emitRoleBindingsSnapshot() error {
	return emitAcrossNamespaces(im, EventRoleBindingsUpdate, im.app.GetRoleBindings)
}

func (im *InformerManager) emitClusterRolesSnapshot() error {
	items, err := im.app.GetClusterRoles()
	if err != nil {
		return err
	}
	emitEvent(im.app.ctx, EventClusterRolesUpdate, items)
	return nil
}

func (im *InformerManager) emitClusterRoleBindingsSnapshot() error {
	items, err := im.app.GetClusterRoleBindings()
	if err != nil {
		return err
	}
	emitEvent(im.app.ctx, EventClusterRoleBindingsUpdate, items)
	return nil
}

func (a *App) startInformerManager() {
	if !a.useInformers {
		return
	}
	if a.currentKubeContext == "" {
		return
	}

	a.informerMu.Lock()
	defer a.informerMu.Unlock()

	if a.informerManager != nil {
		return
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		emitEvent(a.ctx, "k8s:informer:error", map[string]string{"error": err.Error(), "backoff": "5s"})
		return
	}

	manager := NewInformerManager(clientset, a.getPollingNamespaces(), a)
	if err := manager.Start(); err != nil {
		emitEvent(a.ctx, "k8s:informer:error", map[string]string{"error": err.Error(), "backoff": "5s"})
		return
	}

	a.informerManager = manager
}

func (a *App) stopInformerManager() {
	a.informerMu.Lock()
	defer a.informerMu.Unlock()
	if a.informerManager == nil {
		return
	}
	a.informerManager.Stop()
	a.informerManager = nil
}

func (a *App) restartInformerManager() {
	if !a.useInformers {
		return
	}
	a.informerMu.Lock()
	manager := a.informerManager
	a.informerMu.Unlock()

	if manager == nil {
		a.startInformerManager()
		return
	}
	if err := manager.Restart(a.getPollingNamespaces()); err != nil {
		emitEvent(a.ctx, "k8s:informer:error", map[string]string{"error": err.Error(), "backoff": "5s"})
	}
}

func (a *App) getInformerNamespaceFactory(namespace string) (informers.SharedInformerFactory, bool) {
	a.informerMu.Lock()
	manager := a.informerManager
	a.informerMu.Unlock()
	if manager == nil || namespace == "" {
		return nil, false
	}
	return manager.namespaceFactory(namespace)
}

func (a *App) getInformerClusterFactory() (informers.SharedInformerFactory, bool) {
	a.informerMu.Lock()
	manager := a.informerManager
	a.informerMu.Unlock()
	if manager == nil {
		return nil, false
	}

	manager.mu.RLock()
	defer manager.mu.RUnlock()
	if !manager.started || manager.clFactory == nil {
		return nil, false
	}

	return manager.clFactory, true
}
