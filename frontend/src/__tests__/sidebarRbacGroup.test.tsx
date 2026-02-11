import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockCounts = vi.hoisted(() => ({
  counts: {
    roles: 3,
    clusterroles: 2,
    rolebindings: 4,
    clusterrolebindings: 1,
  },
}));

vi.mock('../state/ResourceCountsContext', () => ({
  useResourceCounts: () => mockCounts,
}));

import SidebarSections from '../layout/SidebarSections';

describe('SidebarSections RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCounts.counts = { roles: 3, clusterroles: 2, rolebindings: 4, clusterrolebindings: 1 };
  });

  it('renders RBAC group header with aggregated count and collapsed by default', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarSections selected="pods" onSelect={() => {}} />
      </MemoryRouter>
    );
    const group = container.querySelector('#section-rbac');
    const children = container.querySelector('#section-rbac-children');
    if (!group || !children) throw new Error('Missing RBAC group elements');

    expect(within(group).getByText('10')).toBeTruthy();
    expect(children.className).toContain('collapsed');
    expect(within(group).getByText('›')).toBeTruthy();
  });

  it('expands/collapses on click and keyboard, stops propagation', () => {
    const parentClick = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <div onClick={parentClick}>
          <SidebarSections selected="pods" onSelect={() => {}} />
        </div>
      </MemoryRouter>
    );
    const group = container.querySelector('#section-rbac') as HTMLElement | undefined;
    const children = container.querySelector('#section-rbac-children') as HTMLElement | undefined;
    if (!group || !children) throw new Error('Missing RBAC group elements');

    fireEvent.click(group);
    expect(children.className).not.toContain('collapsed');
    expect(parentClick).not.toHaveBeenCalled();

    fireEvent.keyDown(group, { key: 'Enter' });
    expect(children.className).toContain('collapsed');

    fireEvent.keyDown(group, { key: ' ' });
    expect(children.className).not.toContain('collapsed');
  });

  it('auto-expands when a child is selected', async () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarSections selected="roles" onSelect={() => {}} />
      </MemoryRouter>
    );
    const group = container.querySelector('#section-rbac') as HTMLElement | undefined;
    const children = container.querySelector('#section-rbac-children') as HTMLElement | undefined;
    if (!group || !children) throw new Error('Missing RBAC group elements');

    await waitFor(() => {
      expect(group.getAttribute('aria-expanded')).toBe('true');
      expect(children.getAttribute('aria-hidden')).toBe('false');
    });
  });

  it('renders child counts and aria-labels; missing count shows dash', () => {
    mockCounts.counts.rolebindings = undefined;
    const { container } = render(
      <MemoryRouter>
        <SidebarSections selected="pods" onSelect={() => {}} />
      </MemoryRouter>
    );
    const roles = container.querySelector('#section-roles') as HTMLElement | undefined;
    const clusterroles = container.querySelector('#section-clusterroles') as HTMLElement | undefined;
    const rolebindings = container.querySelector('#section-rolebindings') as HTMLElement | undefined;
    const clusterrolebindings = container.querySelector('#section-clusterrolebindings') as HTMLElement | undefined;
    if (!roles || !clusterroles || !rolebindings || !clusterrolebindings) {
      throw new Error('Missing RBAC child elements');
    }

    expect(within(roles).getByText('3')).toBeTruthy();
    expect(within(clusterroles).getByText('2')).toBeTruthy();
    expect(within(rolebindings).getByText('-')).toBeTruthy();
    expect(within(clusterrolebindings).getByText('1')).toBeTruthy();

    const countSpan = within(roles).getByLabelText('Roles count 3');
    expect(countSpan).toBeTruthy();
  });
});
