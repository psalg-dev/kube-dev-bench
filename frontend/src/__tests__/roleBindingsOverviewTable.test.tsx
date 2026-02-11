import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoleBindingsOverviewTable from '../k8s/resources/rolebindings/RoleBindingsOverviewTable';
import { appApiMocks, resetAllMocks } from './wailsMocks';

describe('RoleBindingsOverviewTable', () => {
  beforeEach(() => {
    resetAllMocks();
    appApiMocks.GetRoleBindings.mockReset();
    appApiMocks.DeleteResource.mockReset();
  });

  it('loads and renders role bindings with Role Ref and subjects count', async () => {
    appApiMocks.GetRoleBindings
      .mockResolvedValueOnce([
        {
          Name: 'rb-1',
          Namespace: 'default',
          Age: '1h',
          RoleRef: { Kind: 'Role', Name: 'read-pods' },
          Subjects: [
            { Kind: 'User', Name: 'alice' },
            { Kind: 'ServiceAccount', Name: 'sa1', Namespace: 'default' },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          Name: 'rb-2',
          Namespace: 'kube-system',
          Age: '2h',
          RoleRef: { Kind: 'ClusterRole', Name: 'admin' },
          Subjects: [],
        },
      ]);

    render(<RoleBindingsOverviewTable namespaces={['default', 'kube-system']} namespace="default" />);

    expect(await screen.findByText('rb-1')).toBeInTheDocument();
    expect(screen.getByText('rb-2')).toBeInTheDocument();

    expect(screen.getByText('Role: read-pods')).toBeInTheDocument();
    const rb1Row = screen
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('rb-1')) as HTMLElement;
    expect(rb1Row).toBeTruthy();
    expect(rb1Row.textContent).toMatch(/\b2\b/);
  });

  it('supports delete action via row actions menu', async () => {
    appApiMocks.GetRoleBindings.mockResolvedValueOnce([
      { Name: 'deleteme', Namespace: 'default', Age: '-', RoleRef: { Kind: 'Role', Name: 'x' }, Subjects: [] },
    ]);

    render(<RoleBindingsOverviewTable namespaces={['default']} namespace="default" />);

    const row = await screen
      .findAllByRole('row')
      .then((rows) => rows.find((r) => r.textContent?.includes('deleteme')) as HTMLElement);
    const actionsBtn = row.querySelector('button[aria-label="Row actions"]') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(appApiMocks.DeleteResource).toHaveBeenCalledWith('rolebinding', 'default', 'deleteme');
    });
  });
});
