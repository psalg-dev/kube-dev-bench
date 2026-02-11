import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import './wailsMocks';
import { genericAPIMock, resetAllMocks, eventsOnMock } from './wailsMocks';
import ClusterRolesOverviewTable from '../k8s/resources/clusterroles/ClusterRolesOverviewTable';

const toUndefined = <T,>(value: T) => Promise.resolve(value as unknown as undefined);

describe('ClusterRolesOverviewTable', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
    eventsOnMock.mockReset();
  });

  it('renders data, has no Namespace column, and subscribes to clusterroles:update', async () => {
    const roles = [
      { name: 'view', Age: '1h', Rules: [{ verbs: ['get'], apiGroups: [''], resources: ['pods'] }] },
      { Name: 'edit', Age: '2h', RulesCount: 2, Rules: [{ verbs: ['list'], apiGroups: [''], resources: ['pods'] }] },
    ];

    genericAPIMock.mockImplementation((name, ..._args) => {
      if (name === 'GetClusterRoles') return toUndefined(roles);
      return toUndefined(undefined);
    });

    render(<ClusterRolesOverviewTable namespace="dev" />);

    await waitFor(() => {
      expect(screen.getByText('Cluster Roles')).toBeInTheDocument();
      expect(screen.getByText('view')).toBeInTheDocument();
      expect(screen.getByText('edit')).toBeInTheDocument();
    });

    // Cluster-scoped table must NOT include Namespace column
    expect(screen.queryByText('Namespace')).toBeNull();

    // Events subscription
    const evt = eventsOnMock.mock.calls.find(([event]) => event === 'clusterroles:update');
    expect(evt).toBeTruthy();
    const cb = evt?.[1] as (payload: unknown) => void;
    cb?.([{ name: 'updated-clusterrole', Age: '-', Rules: [] }]);

    await waitFor(() => {
      expect(screen.getByText('updated-clusterrole')).toBeInTheDocument();
    });
  });

  it('calls DeleteResource when Delete row action is clicked', async () => {
    const roles = [{ name: 'deleteme', Age: '-', Rules: [] }];

    genericAPIMock.mockImplementation((name, ..._args) => {
      if (name === 'GetClusterRoles') return toUndefined(roles);
      if (name === 'DeleteResource') return toUndefined(undefined);
      return toUndefined(undefined);
    });

    render(<ClusterRolesOverviewTable namespace="dev" />);

    await waitFor(() => {
      expect(screen.getByText('deleteme')).toBeInTheDocument();
    });

    const btns = screen.getAllByRole('button', { name: /row actions/i });
    expect(btns.length).toBeGreaterThan(0);
    fireEvent.click(btns[0]);
    fireEvent.click(screen.getByText('Delete'));

    const calls = genericAPIMock.mock.calls.filter(([name]) => name === 'DeleteResource');
    expect(calls.length).toBeGreaterThan(0);
    const last = calls[calls.length - 1];
    expect(last).toEqual(['DeleteResource', 'clusterrole', '', 'deleteme']);
  });
});
