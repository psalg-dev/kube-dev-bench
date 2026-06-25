package app

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// listPageSize is the number of items per page for paginated K8s List calls (IMP-3).
const listPageSize int64 = 500

// listResources is a generic helper that consolidates the common
// client-init → list → transform pattern used by all resource Get* functions.
//
// Parameters:
//   - a: the App instance (for client access)
//   - namespace: the Kubernetes namespace to list from
//   - listFn: fetches the raw list from the API using the clientset
//   - buildFn: transforms each raw item into the result type using current time
//
// This eliminates ~10 lines of identical boilerplate per handler.
// List calls include Limit to cap server-side response size on large clusters (IMP-3).
func listResources[K any, T any](
	a *App,
	namespace string,
	listFn func(clientset kubernetes.Interface, ns string, opts metav1.ListOptions) ([]K, error),
	buildFn func(item *K, now time.Time) T,
) ([]T, error) {
	clientset, err := a.getClient()
	if err != nil {
		return nil, err
	}

	items, err := listFn(clientset, namespace, metav1.ListOptions{Limit: listPageSize})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]T, 0, len(items))
	for i := range items {
		result = append(result, buildFn(&items[i], now))
	}
	return result, nil
}

// listClusterResources is like listResources but for cluster-scoped resources
// that don't take a namespace parameter.
// List calls include Limit to cap server-side response size on large clusters (IMP-3).
func listClusterResources[K any, T any](
	a *App,
	listFn func(clientset kubernetes.Interface, opts metav1.ListOptions) ([]K, error),
	buildFn func(item *K, now time.Time) T,
) ([]T, error) {
	clientset, err := a.getClient()
	if err != nil {
		return nil, err
	}

	items, err := listFn(clientset, metav1.ListOptions{Limit: listPageSize})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	result := make([]T, 0, len(items))
	for i := range items {
		result = append(result, buildFn(&items[i], now))
	}
	return result, nil
}
