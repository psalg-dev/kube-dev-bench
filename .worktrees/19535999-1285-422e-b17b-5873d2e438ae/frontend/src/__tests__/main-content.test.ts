import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SwarmResourceCountsContextValue } from '../docker/SwarmResourceCountsContext';
import type { SwarmStateContextValue } from '../docker/SwarmStateContext';

// Mock all heavy component imports used by main-content
const Stub = () => null;

vi.mock('../k8s/resources/pods/PodOverviewEntry', () => ({
  renderPodOverviewTable: vi.fn(),
}));

vi.mock('../resource-overlay', () => ({
  showResourceOverlay: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

vi.mock('../k8s/resources/deployments/DeploymentsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/cluster/ClusterOverview', () => ({ default: Stub }));
vi.mock('../k8s/graph/GraphView', () => ({ default: Stub }));
vi.mock('../k8s/resources/services/ServicesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/jobs/JobsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/nodes/NodesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/hpa/HPAOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/cronjobs/CronJobsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/daemonsets/DaemonSetsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/statefulsets/StatefulSetsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/replicasets/ReplicaSetsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/configmaps/ConfigMapsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/secrets/SecretsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/ingresses/IngressesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/persistentvolumes/PersistentVolumesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/helmreleases/HelmReleasesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/roles/RolesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/clusterroles/ClusterRolesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/rolebindings/RoleBindingsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable', () => ({ default: Stub }));

vi.mock('../docker/resources/services/SwarmServicesOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/tasks/SwarmTasksOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/nodes/SwarmNodesOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/networks/SwarmNetworksOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/configs/SwarmConfigsOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/secrets/SwarmSecretsOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/stacks/SwarmStacksOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/volumes/SwarmVolumesOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/registry/SwarmRegistriesOverview', () => ({ default: Stub }));
vi.mock('../docker/metrics/SwarmMetricsDashboard', () => ({ default: Stub }));
vi.mock('../docker/topology/TopologyView', () => ({ default: Stub }));
vi.mock('../docker/SwarmOverview', () => ({ default: Stub }));

// These are accessed via `.Provider`
const SwarmStateProvider = vi.fn(({ children }: { children: ReactNode }) => children);
const SwarmCountsProvider = vi.fn(({ children }: { children: ReactNode }) => children);
const ClusterStateProvider = vi.fn(({ children }: { children: ReactNode }) => children);
const ResourceCountsProvider = vi.fn(({ children }: { children: ReactNode }) => children);
vi.mock('../docker/SwarmStateContext', () => ({
  default: { Provider: SwarmStateProvider },
}));
vi.mock('../docker/SwarmResourceCountsContext', () => ({
  default: { Provider: SwarmCountsProvider },
}));
vi.mock('../state/ClusterStateContext', () => ({
  ClusterStateContext: { Provider: ClusterStateProvider },
}));
vi.mock('../state/ResourceCountsContext', () => ({
  ResourceCountsContext: { Provider: ResourceCountsProvider },
}));

async function importFreshMainContent() {
  vi.resetModules();
  // re-apply mocks after resetModules
  // (Vitest keeps factory mocks, but we re-import to ensure fresh module state)
  return await import('../main-content');
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="main-panels"></div>';
});

describe('main-content', () => {
  it('renderPodsMainContent mounts into a stable panel and calls renderPodOverviewTable', async () => {
    const { renderPodsMainContent } = await importFreshMainContent();

    const { renderPodOverviewTable } = await import('../k8s/resources/pods/PodOverviewEntry');
    const { showResourceOverlay } = await import('../resource-overlay');

    // Add a sibling panel to ensure it gets hidden
    const sibling = document.createElement('div');
    sibling.id = 'some-other-panel';
    sibling.style.display = '';
    document.getElementById('main-panels')?.appendChild(sibling);

    renderPodsMainContent(['ns-a', 'ns-b']);

    const panel = document.getElementById('pods-main-panel');
    expect(panel).toBeTruthy();
    expect(panel?.className).toContain('main-panel-pods');

    const inner = document.getElementById('pod-overview-react');
    expect(inner).toBeTruthy();

    expect(renderPodOverviewTable).toHaveBeenCalledTimes(1);
    const args = (renderPodOverviewTable as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.namespace).toBe('ns-a');
    expect(args.namespaces).toEqual(['ns-a', 'ns-b']);
    expect(args.container).toBe(inner);

    // ensure create callback invokes overlay
    args.onCreateResource('job');
    expect(showResourceOverlay).toHaveBeenCalledWith('job');

    // sibling should be hidden
    expect(document.getElementById('some-other-panel')?.style.display).toBe('none');
    expect(panel?.style.display).toBe('');
  }, 10000);

  it('renderResourceMainContent creates a single React root per container', async () => {
    const { renderResourceMainContent } = await importFreshMainContent();
    const { createRoot } = await import('react-dom/client');

    renderResourceMainContent(['ns'], 'deployments');
    renderResourceMainContent(['ns'], 'deployments');

    expect(createRoot).toHaveBeenCalledTimes(1);

    const container = document.getElementById('deployments-overview-react');
    expect(container).toBeTruthy();
    expect(container?.style.display).toBe('');
  });

  it('bridges Swarm contexts for swarm-* sections when options.swarmState is provided', async () => {
    const { renderResourceMainContent } = await importFreshMainContent();
    const { createRoot } = await import('react-dom/client');

    const swarmStateValue: SwarmStateContextValue = {
      connected: true,
      swarmActive: false,
      nodeId: '',
      isManager: false,
      serverVersion: '',
      error: '',
      loading: false,
      showWizard: false,
      initialized: false,
      config: null,
      services: [],
      tasks: [],
      nodes: [],
      networks: [],
      configs: [],
      secrets: [],
      stacks: [],
      volumes: [],
      actions: {
        connect: vi.fn(async () => ({})),
        testConnection: vi.fn(async () => ({})),
        disconnect: vi.fn(async () => {}),
        refreshConnectionStatus: vi.fn(async () => {}),
        openWizard: vi.fn(),
        closeWizard: vi.fn(),
        refreshServices: vi.fn(async () => {}),
        refreshTasks: vi.fn(async () => {}),
        refreshNodes: vi.fn(async () => {}),
        refreshNetworks: vi.fn(async () => {}),
        refreshConfigs: vi.fn(async () => {}),
        refreshSecrets: vi.fn(async () => {}),
        refreshStacks: vi.fn(async () => {}),
        refreshVolumes: vi.fn(async () => {}),
      },
      refreshServices: vi.fn(async () => {}),
      refreshTasks: vi.fn(async () => {}),
      refreshNodes: vi.fn(async () => {}),
      refreshNetworks: vi.fn(async () => {}),
      refreshConfigs: vi.fn(async () => {}),
      refreshSecrets: vi.fn(async () => {}),
      refreshStacks: vi.fn(async () => {}),
      refreshVolumes: vi.fn(async () => {}),
    };

    const swarmCountsValue: SwarmResourceCountsContextValue = {
      counts: {
        services: 1,
        tasks: 0,
        nodes: 0,
        networks: 0,
        configs: 0,
        secrets: 0,
        stacks: 0,
        volumes: 0,
      },
      registriesCount: null,
      lastUpdated: 123,
      refetch: () => {},
    };

    renderResourceMainContent([], 'swarm-services', {
      swarmState: swarmStateValue,
      swarmCounts: swarmCountsValue,
    });

    const root = (createRoot as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(root.render).toHaveBeenCalledTimes(1);

    const renderedEl = root.render.mock.calls[0][0];
    // outer Provider
    expect(renderedEl.type).toBe(SwarmStateProvider);
    expect(renderedEl.props.value).toMatchObject({ connected: true });

    // inner Provider
    const inner = renderedEl.props.children;
    expect(inner.type).toBe(SwarmCountsProvider);
    expect(inner.props.value).toMatchObject({
      counts: {
        services: 1,
        tasks: 0,
        nodes: 0,
        networks: 0,
        configs: 0,
        secrets: 0,
        stacks: 0,
        volumes: 0,
      },
      lastUpdated: 123,
    });
  });

  it('bridges K8s contexts (ClusterState + ResourceCounts) for non-swarm K8s views', async () => {
    const { renderResourceMainContent } = await importFreshMainContent();
    const { createRoot } = await import('react-dom/client');

    const clusterStateValue = {
      selectedContext: 'test-ctx',
      selectedNamespaces: ['ns1'],
      clusterConnected: true,
    };
    const resourceCountsValue = { counts: { deployments: 5 }, lastUpdated: 456 };

    renderResourceMainContent(['ns1'], 'cluster', {
      clusterState: clusterStateValue as unknown,
      resourceCounts: resourceCountsValue,
    });

    const root = (createRoot as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(root.render).toHaveBeenCalledTimes(1);

    const renderedEl = root.render.mock.calls[0][0];
    // outer Provider should be ClusterStateContext.Provider
    expect(renderedEl.type).toBe(ClusterStateProvider);
    expect(renderedEl.props.value).toMatchObject({ selectedContext: 'test-ctx' });

    // inner Provider should be ResourceCountsContext.Provider
    const inner = renderedEl.props.children;
    expect(inner.type).toBe(ResourceCountsProvider);
    expect(inner.props.value).toMatchObject({ counts: { deployments: 5 }, lastUpdated: 456 });
  });
});
