/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { GraphCanvas } from '../k8s/graph/components/GraphCanvas';
type ReactFlowProps = {
  nodes: any[];
  onNodeClick?: (_: unknown, _node: any) => void;
  children?: ReactNode;
};

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, onNodeClick, children }: ReactFlowProps) => (
    <div data-testid="reactflow">
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onNodeClick?.({}, node)}>
          {node.data?.name}
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  applyNodeChanges: (_changes: any, nodes: any[]) => nodes,
  applyEdgeChanges: (_changes: any, edges: any[]) => edges,
  Position: { Top: 'top', Bottom: 'bottom' },
  Handle: () => <div />,
}));

describe('GraphCanvas', () => {
  it('dispatches navigate-to-resource on node click', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    window.addEventListener('navigate-to-resource', handler as EventListener);

    render(
      <GraphCanvas
        nodes={[
          {
            id: 'pod:default:demo-pod',
            position: { x: 0, y: 0 },
            data: { kind: 'Pod', name: 'demo-pod', namespace: 'default' }
          }
        ]}
        edges={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'demo-pod' }));

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ kind: 'Pod', namespace: 'default', name: 'demo-pod' });

    window.removeEventListener('navigate-to-resource', handler as EventListener);
  });
});
