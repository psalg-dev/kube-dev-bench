import { describe, expect, it } from 'vitest';
import { collapsePodsForLargeNamespaceGraph } from '../k8s/graph/utils/graphTransforms';

describe('collapsePodsForLargeNamespaceGraph', () => {
  it('collapses pod nodes into owner badges when threshold is exceeded', () => {
    const graph = {
      nodes: [
        {
          id: 'deployment:default:demo',
          kind: 'Deployment',
          name: 'demo',
          namespace: 'default',
          status: '1/1',
          group: 'workload',
          metadata: { fullName: 'demo' },
        },
        {
          id: 'pod:default:demo-pod-1',
          kind: 'Pod',
          name: 'demo-pod-1',
          namespace: 'default',
          status: 'Running',
          group: 'workload',
          metadata: {},
        },
        {
          id: 'pod:default:demo-pod-2',
          kind: 'Pod',
          name: 'demo-pod-2',
          namespace: 'default',
          status: 'Running',
          group: 'workload',
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'deployment:default:demo',
          target: 'pod:default:demo-pod-1',
          type: 'owns',
          label: 'owns',
        },
        {
          id: 'e2',
          source: 'deployment:default:demo',
          target: 'pod:default:demo-pod-2',
          type: 'owns',
          label: 'owns',
        },
      ],
    };

    const result = collapsePodsForLargeNamespaceGraph(graph, 1);

    expect(result.collapsed).toBe(true);
    expect(result.collapsedPodCount).toBe(2);
    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.edges).toHaveLength(0);
    expect(result.graph.nodes[0].metadata.fullName).toBe('demo [2 pods]');
    expect(result.graph.nodes[0].metadata.collapsedPods).toBe('2');
  });

  it('does not collapse when graph size does not exceed threshold', () => {
    const graph = {
      nodes: [
        {
          id: 'deployment:default:demo',
          kind: 'Deployment',
          name: 'demo',
          namespace: 'default',
          status: '1/1',
          group: 'workload',
          metadata: { fullName: 'demo' },
        },
      ],
      edges: [],
    };

    const result = collapsePodsForLargeNamespaceGraph(graph, 200);

    expect(result.collapsed).toBe(false);
    expect(result.collapsedPodCount).toBe(0);
    expect(result.graph).toEqual(graph);
  });
});
