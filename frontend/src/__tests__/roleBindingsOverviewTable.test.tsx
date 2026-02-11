import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoleBindingsOverviewTable from '../k8s/resources/rolebindings/RoleBindingsOverviewTable';
import { appApiMocks, resetAllMocks, eventsOnMock } from './wailsMocks';

describe('RoleBindingsOverviewTable', () => {
  beforeEach(() => {
    resetAllMocks();
    appApiMocks.GetRoleBindings.mockReset();
    appApiMocks.DeleteResource.mockReset();
    eventsOnMock.mockReset();
    document.body.innerHTML = '';
  });

  it('renders data with Role Ref label and subjects count; subscribes to rolebindings:update', async () => {
    appApiMocks.GetRoleBindings.mockResolvedValueOnce([
      {
        Name: 'rb-alpha',
        Namespace: 'ns1',
        Age: '-',
        RoleRef: { Kind: 'Role', Name: 'read-only' },
        Subjects: [
          { Kind: 'User', Name: 'alice' },
          { Kind: 'ServiceAccount', Name: 'rb-sa', Namespace: 'ns1' },
        ],
      },
    ]);

    render(<RoleBindingsOverviewTable namespaces={['ns1']} namespace="ns1" />);

    await waitFor(() => {
      expect(screen.getByText('Role Bindings')).toBeInTheDocument();
      expect(screen.getByText('rb-alpha')).toBeInTheDocument();
    });

    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes('rb-alpha')) as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Role: read-only');
    expect(row.textContent).toMatch(/\b2\b/);

    const sub = eventsOnMock.mock.calls.find(([event]) => event === 'rolebindings:update');
    expect(sub).toBeTruthy();
    const cb = sub?.[1] as (payload: unknown) => void;
    cb?.([
      {
        Name: 'rb-beta',
        Namespace: 'ns1',
        Age: '-',
        RoleRef: { Kind: 'ClusterRole', Name: 'admin' },
        Subjects: [],
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('rb-beta')).toBeInTheDocument();
    });
  });

  it('calls DeleteResource when Delete row action is clicked', async () => {
    appApiMocks.GetRoleBindings.mockResolvedValueOnce([
      { Name: 'deleteme', Namespace: 'dev', Age: '-', RoleRef: { Kind: 'Role', Name: 'x' }, Subjects: [] },
    ]);

    render(<RoleBindingsOverviewTable namespaces={['dev']} namespace="dev" />);

    await waitFor(() => {
      expect(screen.getByText('deleteme')).toBeInTheDocument();
    });

    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes('deleteme')) as HTMLElement;
    const actionsBtn = row.querySelector('button[aria-label="Row actions"]') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(appApiMocks.DeleteResource).toHaveBeenCalledWith('rolebinding', 'dev', 'deleteme');
    });
  });

  it('shows empty state message when filter excludes all rows', async () => {
    appApiMocks.GetRoleBindings.mockResolvedValueOnce([
      { Name: 'alpha', Namespace: 'ns', Age: '-', RoleRef: { Kind: 'Role', Name: 'r' }, Subjects: [] },
      { Name: 'beta', Namespace: 'ns', Age: '-', RoleRef: { Kind: 'Role', Name: 'r' }, Subjects: [] },
    ]);

    render(<RoleBindingsOverviewTable namespaces={['ns']} namespace="ns" />);
    await screen.findByText('alpha');

    const filter = screen.getByRole('searchbox', { name: /filter/i });
    fireEvent.change(filter, { target: { value: 'zzz' } });
    expect(screen.getByText('No rows match the filter.')).toBeInTheDocument();
  });
});
