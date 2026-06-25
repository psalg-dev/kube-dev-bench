import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Mock the kube API calls used during ClusterStateProvider initialization INCLUDING GetResourceCounts
vi.mock('../k8s/resources/kubeApi', () => ({
  GetKubeConfigs: vi.fn(() => Promise.resolve([{ path: '/tmp/kubeconfig', name: 'kubeconfig', contexts: ['ctx1'] }])),
  GetCurrentConfig: vi.fn(() => Promise.resolve({ currentContext: 'ctx1', preferredNamespaces: ['ns1'] })),
  GetKubeContexts: vi.fn(() => Promise.resolve(['ctx1', 'ctx2'])),
  GetNamespaces: vi.fn(() => Promise.resolve(['ns1', 'ns2'])),
  SetCurrentKubeContext: vi.fn(() => Promise.resolve()),
  SetCurrentNamespace: vi.fn(() => Promise.resolve()),
  SetPreferredNamespaces: vi.fn(() => Promise.resolve()),
  GetConnectionStatus: vi.fn(() => Promise.resolve({ ok: true })),
  GetResourceCounts: vi.fn(() => Promise.resolve({
    podStatus: { running: 1, pending: 0, failed: 0, succeeded: 0, unknown: 0, total: 1 },
    deployments: 2, jobs: 1, cronjobs: 0, daemonsets: 0, statefulsets: 0, replicasets: 0,
    configmaps: 0, secrets: 0, ingresses: 0, persistentvolumeclaims: 0, persistentvolumes: 0,
  })),
}));

// Mock runtime events to no-op
vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

// Mock Holmes API
vi.mock('../holmes/holmesApi', () => ({
  GetHolmesConfig: vi.fn(() => Promise.resolve({ enabled: false, endpoint: '' })),
  SaveHolmesConfig: vi.fn(() => Promise.resolve()),
  AskHolmes: vi.fn(() => Promise.resolve('')),
  CheckHolmesDeployment: vi.fn(() => Promise.resolve({ deployed: false })),
  DeployHolmesGPT: vi.fn(() => Promise.resolve()),
  UndeployHolmesGPT: vi.fn(() => Promise.resolve()),
  onHolmesDeploymentStatus: vi.fn(() => () => {}),
  onHolmesConfigChanged: vi.fn(() => () => {}),
  onHolmesChatStream: vi.fn(() => () => {}),
}));

// Silence notification side-effects
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn(),
}));

// Capture calls to content render functions
const mockRenderPods = vi.fn();
const mockRenderResource = vi.fn();
vi.mock('../main-content', () => ({
  renderPodsMainContent: (...args: unknown[]) => mockRenderPods(...args),
  renderResourceMainContent: (...args: unknown[]) => mockRenderResource(...args),
}));

// Import after mocks so the component uses mocked modules
import { MemoryRouter } from 'react-router-dom';
import AppContainer from '../layout/AppContainer';

describe('AppContainer resource switching', () => {
  beforeEach(() => {
    mockRenderPods.mockClear();
    mockRenderResource.mockClear();
  });
  afterEach(() => cleanup());

  it('calls renderResourceMainContent with the selectedSection when switching to Jobs (regression test for missing parameter)', async () => {
    render(
      <MemoryRouter initialEntries={['/pods']}>
        <AppContainer />
      </MemoryRouter>
    );

    // Wait for initial pods render (cluster becomes connected)
    await waitFor(() => expect(mockRenderPods).toHaveBeenCalled(), { timeout: 2000 });

    // Click on Jobs sidebar entry
    const jobsItem = await screen.findByText('Jobs');
    fireEvent.click(jobsItem);

    await waitFor(() => {
      // Ensure resource renderer invoked with second arg = 'jobs'
      expect(mockRenderResource).toHaveBeenCalled();
      const lastCall = mockRenderResource.mock.calls.at(-1);
      if (!lastCall) throw new Error('Expected renderResourceMainContent call');
      expect(lastCall[1]).toBe('jobs');
    });
  });

  it('calls renderResourceMainContent with correct section for multiple switches', async () => {
    render(
      <MemoryRouter initialEntries={['/pods']}>
        <AppContainer />
      </MemoryRouter>
    );
    await waitFor(() => expect(mockRenderPods).toHaveBeenCalled(), { timeout: 2000 });

    const deploymentsItem = await screen.findByText('Deployments');
    const secretsItem = await screen.findByText('Secrets');

    fireEvent.click(deploymentsItem);
    fireEvent.click(secretsItem);

    await waitFor(() => {
      // Find a call whose second arg is 'secrets'
      const sections = mockRenderResource.mock.calls.map(c => c[1]);
      expect(sections).toContain('deployments');
      expect(sections).toContain('secrets');
    });
  });
});
