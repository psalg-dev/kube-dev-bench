package app

import "time"

// StartRBACPolling registers polling loops for RBAC resources.
func (a *App) StartRBACPolling() {
	startResourcePolling(a, ResourcePollingConfig[RoleInfo]{
		EventName: EventRolesUpdate,
		FetchFn:   a.GetRoles,
	})
	startResourcePolling(a, ResourcePollingConfig[RoleBindingInfo]{
		EventName: EventRoleBindingsUpdate,
		FetchFn:   a.GetRoleBindings,
	})

	startClusterRBACPolling(a, EventClusterRolesUpdate, a.GetClusterRoles)
	startClusterRBACPolling(a, EventClusterRoleBindingsUpdate, a.GetClusterRoleBindings)
}

func startClusterRBACPolling[T any](a *App, eventName string, fetchFn func() ([]T, error)) {
	go func() {
		ticker := time.NewTicker(time.Second)
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

			items, err := fetchFn()
			if err != nil {
				continue
			}

			emitEvent(a.ctx, eventName, items)
		}
	}()
}
