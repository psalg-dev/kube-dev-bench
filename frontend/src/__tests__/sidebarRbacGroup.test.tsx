import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock counts hook to drive SidebarSections
vi.mock('../state/ResourceCountsContext', () => ({
  useResourceCounts: () => ({
    counts: {
      roles: 2,
      clusterroles: 3,
      rolebindings: 1,
      clusterrolebindings: 4,
    },
    lastUpdated: Date.now(),
  }),
}));

import SidebarSections from '../layout/SidebarSections';

describe('SidebarSections RBAC group', () => {
  beforeEach(() => {
    // ensure clean DOM
    document.body.innerHTML = '';
  });

  it('renders RBAC group collapsed by default with aggregated count', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarSections selected="pods" onSelect={() => {}} />
      </MemoryRouter>
    );

    const header = container.querySelector('#section-rbac');
    const children = container.querySelector('#section-rbac-children');
    expect(header).toBeTruthy();
    expect(children).toBeTruthy();

    // Aggregated count: 2 + 3 + 1 + 4 = 10
    const agg = within(header as HTMLElement).getByText('10');
    expect(agg).toBeTruthy();

    // Collapsed by default
    expect(children?.className).toContain('collapsed');
  });

  it('expands on mouse click and keyboard (Enter/Space)', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarSections selected="pods" onSelect={() => {}} />
      </MemoryRouter>
    );

    const header = container.querySelector('#section-rbac') as HTMLElement;
    const children = container.querySelector('#section-rbac-children') as HTMLElement;
    expect(children.className).toContain('collapsed');

    fireEvent.click(header);
    expect(children.className).not.toContain('collapsed');

    // Collapse via keyboard Enter
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(children.className).toContain('collapsed');

    // Expand via keyboard Space
    fireEvent.keyDown(header, { key: ' ' });
    expect(children.className).not.toContain('collapsed');
  });

  it('auto-expands when a child is selected', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarSections selected="roles" onSelect={() => {}} />
      </MemoryRouter>
    );

    const children = container.querySelector('#section-rbac-children') as HTMLElement;
    expect(children.className).not.toContain('collapsed');

    const childLink = container.querySelector('#section-roles') as HTMLElement;
    expect(childLink).toBeTruthy();
    // Child count present
    const childCount = within(childLink).getByText('2');
    expect(childCount).toBeTruthy();
  });

  it('shows dash for unknown/missing child counts and sets aria-current on selected child', async () => {
    vi.resetModules();
    vi.doMock('../state/ResourceCountsContext', () => ({
      useResourceCounts: () => ({
        counts: {
          roles: 2,
          // clusterroles missing
          rolebindings: 1,
          clusterrolebindings: 4,
        },
        lastUpdated: Date.now(),
      }),
    }));

    const { default: FreshSidebarSections } = await import('../layout/SidebarSections');

    const { container } = render(
      <MemoryRouter>
        <FreshSidebarSections selected="clusterroles" onSelect={() => {}} />
      </MemoryRouter>
    );

    const link = container.querySelector('#section-clusterroles') as HTMLElement;
    expect(link).toBeTruthy();
    expect(link.className).toContain('selected');

    // Dash when value is not a number
    expect(screen.getByText('-')).toBeTruthy();

    // aria-current is set on selected child
    expect(link.getAttribute('aria-current')).toBe('page');
  });
});
