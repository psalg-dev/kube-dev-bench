import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GraphView from '../k8s/graph/GraphView';

vi.mock('../state/ClusterStateContext', () => ({
  useClusterState: () => ({ selectedNamespaces: ['default'] }),
}));

vi.mock('../k8s/graph/utils/graphApi', () => ({
  getNamespaceGraph: vi.fn(),
  getStorageGraph: vi.fn(),
  getNetworkPolicyGraph: vi.fn(),
  getRBACGraph: vi.fn(async () => ({
    nodes: [
      { id: 'user:alice', kind: 'User', name: 'alice', namespace: '', status: 'Subject', group: 'rbac', metadata: { fullName: 'User: alice' } },
      { id: 'rolebinding:default:reader-binding', kind: 'RoleBinding', name: 'reader-binding', namespace: 'default', status: 'Active', group: 'rbac', metadata: {} },
      { id: 'role:default:reader', kind: 'Role', name: 'reader', namespace: 'default', status: 'Active', group: 'rbac', metadata: { rules: 'get,list core/pods' } },
      { id: 'serviceaccount:default:app-sa', kind: 'ServiceAccount', name: 'app-sa', namespace: 'default', status: 'Active', group: 'config', metadata: {} },
      { id: 'pod:default:app-pod', kind: 'Pod', name: 'app-pod', namespace: 'default', status: 'Running', group: 'workload', metadata: {} },
      { id: 'group:team-a', kind: 'Group', name: 'team-a', namespace: '', status: 'Subject', group: 'rbac', metadata: { fullName: 'Group: team-a' } },
      { id: 'deployment:default:orphan', kind: 'Deployment', name: 'orphan', namespace: 'default', status: '1/1', group: 'workload', metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'user:alice', target: 'rolebinding:default:reader-binding', type: 'binds', label: 'subject' },
      { id: 'e2', source: 'rolebinding:default:reader-binding', target: 'role:default:reader', type: 'binds', label: 'binds to' },
      { id: 'e3', source: 'serviceaccount:default:app-sa', target: 'rolebinding:default:reader-binding', type: 'binds', label: 'subject' },
      { id: 'e4', source: 'pod:default:app-pod', target: 'serviceaccount:default:app-sa', type: 'binds', label: 'uses' },
    ],
  })),
}));

vi.mock('../k8s/graph/hooks/useGraphLayout', () => ({
  useGraphLayout: (graphData: unknown) => {
    if (!graphData?.nodes || !graphData?.edges) {
      return { nodes: [], edges: [] };
    }

    return {
      nodes: graphData.nodes.map((node: unknown, index: number) => ({
        id: node.id,
        position: { x: 10 * index, y: 10 * index },
        data: {
          kind: node.kind,
          name: node.name,
          namespace: node.namespace,
          status: node.status,
          group: node.group,
          metadata: node.metadata,
          dimmed: Boolean(node.dimmed),
        },
      })),
      edges: graphData.edges.map((edge: unknown) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: {
          edgeType: edge.type,
          label: edge.label,
          dimmed: Boolean(edge.dimmed),
        },
      })),
    };
  },
}));

vi.mock('../k8s/graph/components/GraphCanvas', () => ({
  GraphCanvas: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => {
    const dimmedNodes = nodes.filter((node) => node.data?.dimmed).length;
    const dimmedEdges = edges.filter((edge) => edge.data?.dimmed).length;
    return (
      <div data-testid="graph-canvas-mock">
        nodes:{nodes.length} dimmedNodes:{dimmedNodes} edges:{edges.length} dimmedEdges:{dimmedEdges}
      </div>
    );
  },
}));

describe('GraphView RBAC subject search', () => {
  it('dims non-matching subgraphs when searching subject', async () => {
    const user = userEvent.setup();

    render(<GraphView mode="rbac" />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-canvas-mock')).toHaveTextContent('nodes:7 dimmedNodes:0 edges:4 dimmedEdges:0');
    });

    const searchInput = screen.getByLabelText('What can X do?');
    await user.type(searchInput, 'alice');

    await waitFor(() => {
      expect(screen.getByTestId('graph-canvas-mock')).toHaveTextContent('nodes:7 dimmedNodes:2 edges:4 dimmedEdges:0');
    });
  });
});
