// Persistence helpers for saving user selections to the backend.
// Abstracts the dual calls so callers have a single promise to await.
import { SetCurrentNamespace } from '../k8s/resources/kubeApi';

/**
 * Persist preferred namespaces (if backend function exists) and current namespace.
 * Silently ignores errors from individual calls (mirrors previous behavior).
 * @param {string[]} namespaces
 * @param {string} currentNamespace
 * @returns {Promise<void>}
 */
export async function persistNamespaces(namespaces, currentNamespace) {
  try {
    const preferredFn = window?.go?.main?.App?.SetPreferredNamespaces;
    await Promise.all([
      preferredFn ? preferredFn(namespaces).catch(()=>{}) : Promise.resolve(),
      currentNamespace ? SetCurrentNamespace(currentNamespace).catch(()=>{}) : Promise.resolve(),
    ]);
  } catch(_) {
    // Intentionally swallow to preserve previous tolerance behavior
  }
}

