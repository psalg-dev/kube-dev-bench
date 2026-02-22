import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RolesOverviewTable from '../k8s/resources/roles/RolesOverviewTable';
import { appApiMocks, eventsOnMock, resetAllMocks } from './wailsMocks';
const sampleRoles = [
  {
    Name: 'reader',
    Namespace: 'default',
    Age: '5m',
    Rules: [{ Verbs: ['get'], APIGroups: [''], Resources: ['pods'] }],
    RulesCount: 1,
    Labels: { app: 'test' },
  },
  {
    Name: 'writer',
    Namespace: 'dev',
    Age: '10m',
    Rules: [{ Verbs: ['create', 'update'], APIGroups: ['apps'], Resources: ['deployments'] }],
    RulesCount: 2,
  },
];

describe('RolesOverviewTable', () => {
  beforeEach(() => {
    resetAllMocks();
    appApiMocks.GetRoles.mockResolvedValue(sampleRoles);
    appApiMocks.DeleteResource.mockResolvedValue(undefined);
  });

  it('fetches roles and renders rows/cells', async () => {
    render(<RolesOverviewTable namespace="default" />);

    await waitFor(() => {
      expect(eventsOnMock).toHaveBeenCalledWith('roles:update', expect.any(Function));
    });

    expect(await screen.findByText('reader')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes('reader')) as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('1');
  });

  it('shows empty state when no roles returned', async () => {
    resetAllMocks();
    appApiMocks.GetRoles.mockResolvedValue([]);
    render(<RolesOverviewTable namespace="default" />);

    await waitFor(() => {
      expect(screen.getByText('No Roles deployed in this namespace')).toBeInTheDocument();
    });
  });

  it('row Delete action calls DeleteResource(role, namespace, name)', async () => {
    render(<RolesOverviewTable namespace="default" />);
    await screen.findByText('reader');

    const actionsButton = screen.getAllByRole('button', { name: /row actions/i })[0];
    fireEvent.click(actionsButton);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(appApiMocks.DeleteResource).toHaveBeenCalledWith('role', 'default', 'reader');
    });
  });
});
