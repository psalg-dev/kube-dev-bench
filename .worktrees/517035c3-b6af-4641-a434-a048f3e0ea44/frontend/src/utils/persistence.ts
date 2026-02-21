// Persistence helpers for saving user selections to the backend.
// Abstracts the dual calls so callers have a single promise to await.
import { SetCurrentNamespace } from '../k8s/resources/kubeApi';

type SetPreferredNamespacesFn = (_namespaces: string[]) => Promise<void>;

/**
 * Persist preferred namespaces (if backend function exists) and current namespace.
 * Silently ignores errors from individual calls (mirrors previous behavior).
 */
export async function persistNamespaces(namespaces: string[], currentNamespace: string): Promise<void> {
  try {
    const preferredFn = window?.go?.main?.App?.SetPreferredNamespaces as SetPreferredNamespacesFn | undefined;
    await Promise.all([
      preferredFn ? preferredFn(namespaces).catch(() => {}) : Promise.resolve(),
      currentNamespace ? SetCurrentNamespace(currentNamespace).catch(() => {}) : Promise.resolve(),
    ]);
  } catch {
    // Intentionally swallow to preserve previous tolerance behavior
  }
}
