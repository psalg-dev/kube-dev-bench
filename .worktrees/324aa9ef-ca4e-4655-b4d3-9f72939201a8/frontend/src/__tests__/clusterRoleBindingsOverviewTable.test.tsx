import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import ClusterRoleBindingsOverviewTable from '../k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable';
import './wailsMocks';
import { eventsOnMock, genericAPIMock, resetAllMocks } from './wailsMocks';

const toUndefined = <T,>(value: T) => Promise.resolve(value as unknown as undefined);

describe('ClusterRoleBindingsOverviewTable', () => {
  beforeEach(() => {
    resetAllMocks();
    genericAPIMock.mockReset();
    eventsOnMock.mockReset();
  });

  it('renders data, has no Namespace column, and subscribes to clusterrolebindings:update', async () => {
    const bindings = [
      { name: 'binding-a', Age: '1h', RoleRef: { Kind: 'ClusterRole', Name: 'view' }, Subjects: [{ Kind: 'User', Name: 'alice' }] },
      { Name: 'binding-b', Age: '2h', RoleRef: { Kind: 'ClusterRole', Name: 'edit' }, Subjects: [] },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetClusterRoleBindings') return toUndefined(bindings);
      return toUndefined(undefined);
    });

    render(<ClusterRoleBindingsOverviewTable namespace="dev" />);

    await waitFor(() => {
      expect(screen.getByText('Cluster Role Bindings')).toBeInTheDocument();
      expect(screen.getByText('binding-a')).toBeInTheDocument();
      expect(screen.getByText('binding-b')).toBeInTheDocument();
    });

    expect(screen.queryByText('Namespace')).toBeNull();

    const evt = eventsOnMock.mock.calls.find(([event]) => event === 'clusterrolebindings:update');
    expect(evt).toBeTruthy();
    const cb = evt?.[1] as (_payload: unknown) => void;
    cb?.([{ name: 'binding-c', Age: '-', RoleRef: { Kind: 'ClusterRole', Name: 'admin' }, Subjects: [] }]);

    await waitFor(() => {
      expect(screen.getByText('binding-c')).toBeInTheDocument();
    });
  });

  it('calls DeleteResource when Delete row action is clicked', async () => {
    const bindings = [{ name: 'deleteme', Age: '-', RoleRef: { Kind: 'ClusterRole', Name: 'view' }, Subjects: [] }];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetClusterRoleBindings') return toUndefined(bindings);
      if (name === 'DeleteResource') return toUndefined(undefined);
      return toUndefined(undefined);
    });

    render(<ClusterRoleBindingsOverviewTable namespace="dev" />);

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
    expect(last).toEqual(['DeleteResource', 'clusterrolebinding', '', 'deleteme']);
  });
});
