import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy component imports used by main-content.js
const Stub = () => null;

vi.mock('../k8s/resources/pods/PodOverviewEntry', () => ({
  renderPodOverviewTable: vi.fn(),
}));

vi.mock('../resource-overlay.js', () => ({
  showResourceOverlay: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

// K8s OverviewTable mocks (consolidated using GenericResourceTable)
vi.mock('../k8s/resources/deployments/DeploymentsOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/services/ServicesOverviewTable', () => ({ default: Stub }));
vi.mock('../k8s/resources/jobs/JobsOverviewTable', () => ({ default: Stub }));
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

vi.mock('../docker/resources/services/SwarmServicesOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/tasks/SwarmTasksOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/nodes/SwarmNodesOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/networks/SwarmNetworksOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/configs/SwarmConfigsOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/secrets/SwarmSecretsOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/stacks/SwarmStacksOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/resources/volumes/SwarmVolumesOverviewTable', () => ({ default: Stub }));
vi.mock('../docker/registry/SwarmRegistriesOverview.jsx', () => ({ default: Stub }));
vi.mock('../docker/metrics/SwarmMetricsDashboard.jsx', () => ({ default: Stub }));
vi.mock('../docker/topology/TopologyView.jsx', () => ({ default: Stub }));
vi.mock('../docker/SwarmOverview.jsx', () => ({ default: Stub }));

// These are accessed via `.Provider`
const SwarmStateProvider = vi.fn((props) => props.children);
const SwarmCountsProvider = vi.fn((props) => props.children);
vi.mock('../docker/SwarmStateContext.jsx', () => ({
  default: { Provider: SwarmStateProvider },
}));
vi.mock('../docker/SwarmResourceCountsContext.jsx', () => ({
  default: { Provider: SwarmCountsProvider },
}));

async function importFreshMainContent() {
  vi.resetModules();
  // re-apply mocks after resetModules
  // (Vitest keeps factory mocks, but we re-import to ensure fresh module state)
  return await import('../main-content.js');
}

beforeEach(() => {
  document.body.innerHTML = '<div id="main-panels"></div>';
});

describe('main-content.js', () => {
  it('renderPodsMainContent mounts into a stable panel and calls renderPodOverviewTable', async () => {
    const { renderPodsMainContent } = await importFreshMainContent();

    const { renderPodOverviewTable } = await import('../k8s/resources/pods/PodOverviewEntry');
    const { showResourceOverlay } = await import('../resource-overlay.js');

    // Add a sibling panel to ensure it gets hidden
    const sibling = document.createElement('div');
    sibling.id = 'some-other-panel';
    sibling.style.display = '';
    document.getElementById('main-panels').appendChild(sibling);

    renderPodsMainContent(['ns-a', 'ns-b']);

    const panel = document.getElementById('pods-main-panel');
    expect(panel).toBeTruthy();
    expect(panel.className).toContain('main-panel-pods');

    const inner = document.getElementById('pod-overview-react');
    expect(inner).toBeTruthy();

    expect(renderPodOverviewTable).toHaveBeenCalledTimes(1);
    const args = renderPodOverviewTable.mock.calls[0][0];
    expect(args.namespace).toBe('ns-a');
    expect(args.namespaces).toEqual(['ns-a', 'ns-b']);
    expect(args.container).toBe(inner);

    // ensure create callback invokes overlay
    args.onCreateResource('job');
    expect(showResourceOverlay).toHaveBeenCalledWith('job');

    // sibling should be hidden
    expect(document.getElementById('some-other-panel').style.display).toBe('none');
    expect(panel.style.display).toBe('');
  });

  it('renderResourceMainContent creates a single React root per container', async () => {
    const { renderResourceMainContent } = await importFreshMainContent();
    const { createRoot } = await import('react-dom/client');

    renderResourceMainContent(['ns'], 'deployments');
    renderResourceMainContent(['ns'], 'deployments');

    expect(createRoot).toHaveBeenCalledTimes(1);

    const container = document.getElementById('deployments-overview-react');
    expect(container).toBeTruthy();
    expect(container.style.display).toBe('');
  });

  it('bridges Swarm contexts for swarm-* sections when options.swarmState is provided', async () => {
    const { renderResourceMainContent } = await importFreshMainContent();
    const { createRoot } = await import('react-dom/client');

    renderResourceMainContent([], 'swarm-services', {
      swarmState: { connected: true },
      swarmCounts: { counts: { services: 1 }, lastUpdated: 123, refetch: () => {} },
    });

    const root = createRoot.mock.results[0].value;
    expect(root.render).toHaveBeenCalledTimes(1);

    const renderedEl = root.render.mock.calls[0][0];
    // outer Provider
    expect(renderedEl.type).toBe(SwarmStateProvider);
    expect(renderedEl.props.value).toEqual({ connected: true });

    // inner Provider
    const inner = renderedEl.props.children;
    expect(inner.type).toBe(SwarmCountsProvider);
    expect(inner.props.value).toMatchObject({ counts: { services: 1 }, lastUpdated: 123 });
  });
});
