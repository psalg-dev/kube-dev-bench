/**
 * Utility for navigating to resources with the bottom panel open.
 * Dispatches a 'navigate-to-resource' custom event that is handled by App.jsx/AppContainer.jsx.
 */

import type { CSSProperties } from 'react';

export interface NavigateToResourceOptions {
  resource: string;
  name: string;
  namespace?: string;
}

/**
 * Navigate to a Kubernetes or Swarm resource and open its bottom panel.
 */
export function navigateToResource({ resource, name, namespace = '' }: NavigateToResourceOptions): void {
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
export const resourceLinkStyles: CSSProperties = {
  cursor: 'pointer',
  color: 'var(--gh-link, #58a6ff)',
  textDecoration: 'none',
  transition: 'color 0.15s ease',
};

/**
 * CSS styles for clickable resource links on hover (use in :hover pseudo-class or JS)
 */
export const resourceLinkHoverStyles: CSSProperties = {
  textDecoration: 'underline',
  color: 'var(--gh-link-hover, #79c0ff)',
};
