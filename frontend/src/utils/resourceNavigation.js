/**
 * Utility for navigating to resources with the bottom panel open.
 * Dispatches a 'navigate-to-resource' custom event that is handled by App.jsx/AppContainer.jsx.
 */

/**
 * Navigate to a Kubernetes or Swarm resource and open its bottom panel.
 * @param {Object} options - Navigation options
 * @param {string} options.resource - The resource type (e.g., 'Pod', 'Deployment', 'SwarmService')
 * @param {string} options.name - The name of the resource
 * @param {string} [options.namespace] - The namespace (for namespaced K8s resources)
 */
export function navigateToResource({ resource, name, namespace = '' }) {
  const event = new CustomEvent('navigate-to-resource', {
    detail: {
      resource,
      name,
      namespace,
    },
  });
  window.dispatchEvent(event);
}

/**
 * CSS styles for clickable resource links
 */
export const resourceLinkStyles = {
  cursor: 'pointer',
  color: 'var(--gh-link, #58a6ff)',
  textDecoration: 'none',
  transition: 'color 0.15s ease',
};

/**
 * CSS styles for clickable resource links on hover (use in :hover pseudo-class or JS)
 */
export const resourceLinkHoverStyles = {
  textDecoration: 'underline',
  color: 'var(--gh-link-hover, #79c0ff)',
};
