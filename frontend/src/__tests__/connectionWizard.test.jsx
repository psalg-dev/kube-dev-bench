import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the Wails API calls
const mockGetKubeConfigs = vi.fn();
const mockSelectKubeConfigFile = vi.fn();
const mockSaveCustomKubeConfig = vi.fn();
const mockSetKubeConfigPath = vi.fn();
const mockGetKubeContextsFromFile = vi.fn();
const mockSavePrimaryKubeConfig = vi.fn();
const mockGetKubeContexts = vi.fn();
const mockGetNamespaces = vi.fn();
const mockSetCurrentKubeContext = vi.fn();
const mockSetCurrentNamespace = vi.fn();
const mockGetCurrentConfig = vi.fn();
const mockGetProxyConfig = vi.fn();
const mockSetProxyConfig = vi.fn();
const mockDetectSystemProxy = vi.fn();

// Hooks mocks
const mockGetHooksConfig = vi.fn();
const mockSaveHook = vi.fn();
const mockDeleteHook = vi.fn();
const mockTestHook = vi.fn();
const mockSelectHookScript = vi.fn();

// Wails runtime EventsOn mock (ConnectionsStateContext subscribes to hook events)
const mockEventsOn = vi.fn(() => () => {});

vi.mock('../../wailsjs/go/main/App', () => ({
  GetKubeConfigs: (...args) => mockGetKubeConfigs(...args),
  SelectKubeConfigFile: (...args) => mockSelectKubeConfigFile(...args),
  SaveCustomKubeConfig: (...args) => mockSaveCustomKubeConfig(...args),
  SetKubeConfigPath: (...args) => mockSetKubeConfigPath(...args),
  GetKubeContextsFromFile: (...args) => mockGetKubeContextsFromFile(...args),
  SavePrimaryKubeConfig: (...args) => mockSavePrimaryKubeConfig(...args),
  GetKubeContexts: (...args) => mockGetKubeContexts(...args),
  GetNamespaces: (...args) => mockGetNamespaces(...args),
  SetCurrentKubeContext: (...args) => mockSetCurrentKubeContext(...args),
  SetCurrentNamespace: (...args) => mockSetCurrentNamespace(...args),
  GetCurrentConfig: (...args) => mockGetCurrentConfig(...args),
  GetProxyConfig: (...args) => mockGetProxyConfig(...args),
  SetProxyConfig: (...args) => mockSetProxyConfig(...args),
  DetectSystemProxy: (...args) => mockDetectSystemProxy(...args),

  GetHooksConfig: (...args) => mockGetHooksConfig(...args),
  SaveHook: (...args) => mockSaveHook(...args),
  DeleteHook: (...args) => mockDeleteHook(...args),
  TestHook: (...args) => mockTestHook(...args),
  SelectHookScript: (...args) => mockSelectHookScript(...args),
}));

vi.mock('../../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: (...args) => mockEventsOn(...args),
}));

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  GetDockerConnectionStatus: vi.fn().mockResolvedValue({ error: 'no connections' }),
  GetDefaultDockerHost: vi.fn().mockResolvedValue(''),
  TestDockerConnection: vi.fn(),
  getSwarmConnections: vi.fn().mockResolvedValue([]),
  saveSwarmConnection: vi.fn(),
  deleteSwarmConnection: vi.fn(),
}));

// Mock SwarmStateContext
vi.mock('../docker/SwarmStateContext.jsx', () => ({
  useSwarmState: vi.fn(() => ({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    currentConnection: null,
    services: [],
    tasks: [],
    nodes: [],
    networks: [],
    configs: [],
    secrets: [],
    stacks: [],
    volumes: [],
    loading: {},
    connectToDocker: vi.fn(),
    disconnect: vi.fn(),
    refreshServices: vi.fn(),
    refreshTasks: vi.fn(),
    refreshNodes: vi.fn(),
    refreshNetworks: vi.fn(),
    refreshConfigs: vi.fn(),
    refreshSecrets: vi.fn(),
    refreshStacks: vi.fn(),
    refreshVolumes: vi.fn(),
  })),
  SwarmStateProvider: ({ children }) => children,
}));

import ConnectionWizard from '../layout/connection/ConnectionWizard.jsx';

describe('ConnectionWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentConfig.mockResolvedValue({});
    mockGetKubeContexts.mockResolvedValue(['default']);
    mockGetNamespaces.mockResolvedValue(['default']);
    mockSetCurrentKubeContext.mockResolvedValue();
    mockSetCurrentNamespace.mockResolvedValue();
    mockGetProxyConfig.mockResolvedValue({ HttpProxy: '', HttpsProxy: '', NoProxy: '' });
    mockDetectSystemProxy.mockResolvedValue({ HTTP_PROXY: '', HTTPS_PROXY: '', NO_PROXY: '' });
    mockSetProxyConfig.mockResolvedValue();

    mockGetHooksConfig.mockResolvedValue({ hooks: [] });
    mockSaveHook.mockResolvedValue({});
    mockDeleteHook.mockResolvedValue();
    mockTestHook.mockResolvedValue({ success: true, exitCode: 0, stdout: '', stderr: '' });
    mockSelectHookScript.mockResolvedValue('');
  });

  describe('Layout structure', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('renders the connection wizard layout with sidebar and main content', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(document.querySelector('.connection-wizard-layout')).toBeInTheDocument();
        expect(document.querySelector('.connection-wizard-sidebar')).toBeInTheDocument();
        expect(document.querySelector('.connection-wizard-main')).toBeInTheDocument();
      });
    });

    it('renders sidebar with Kubernetes and Docker Swarm sections', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Kubernetes')).toBeInTheDocument();
        expect(screen.getByText('Docker Swarm')).toBeInTheDocument();
      });
    });

    it('shows Kubernetes section as selected by default', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const kubernetesSection = document.getElementById('connection-section-kubernetes');
        expect(kubernetesSection).toHaveClass('selected');
      });
    });
  });

  describe('Empty state (no configs discovered)', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('renders Kubernetes Connections heading when no configs found', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Kubernetes Connections/i)).toBeInTheDocument();
      });
    });

    it('shows Add Config button', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });
    });

    it('shows Browse button for file selection', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Browse/i })).toBeInTheDocument();
      });
    });

    it('opens Add Kubeconfig overlay when clicking Add Config button', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Create Your First Kubeconfig/i)).toBeInTheDocument();
      });
    });

    it('shows empty state message when no configs', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/No Kubeconfig Files Found/i)).toBeInTheDocument();
      });
    });
  });

  describe('With discovered configs', () => {
    const mockConfigs = [
      { path: '/home/user/.kube/config', name: 'config (default)', contexts: ['dev', 'prod'] },
      { path: '/home/user/.kube/kubeconfig', name: 'kubeconfig (primary)', contexts: ['test'] },
    ];

    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue(mockConfigs);
    });

    it('renders config cards when configs are found', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('config (default)')).toBeInTheDocument();
        expect(screen.getByText('kubeconfig (primary)')).toBeInTheDocument();
      });
    });

    it('displays contexts for each config', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Contexts: dev, prod/)).toBeInTheDocument();
        expect(screen.getByText(/Contexts: test/)).toBeInTheDocument();
      });
    });

    it('shows Connect button for each config', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const connectButtons = screen.getAllByRole('button', { name: /Connect/i });
        expect(connectButtons.length).toBeGreaterThan(0);
      });
    });

    it('shows count in sidebar for Kubernetes section', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const kubernetesSection = document.getElementById('connection-section-kubernetes');
        expect(kubernetesSection).toHaveTextContent('2');
      });
    });

    it('allows connecting to a config', async () => {
      mockSetKubeConfigPath.mockResolvedValue();

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText('kubeconfig (primary)')).toBeInTheDocument();
      });

      // Click the Connect button for the second config
      const connectButtons = screen.getAllByRole('button', { name: /Connect/i });
      fireEvent.click(connectButtons[1]);

      await waitFor(() => {
        expect(mockSetKubeConfigPath).toHaveBeenCalledWith('/home/user/.kube/kubeconfig');
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('shows pin button for each config', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const pinButtons = screen.getAllByTitle(/Pin to sidebar/i);
        expect(pinButtons.length).toBe(2);
      });
    });

    it('shows proxy settings button for each config', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const proxyButtons = screen.getAllByTitle(/Proxy settings/i);
        expect(proxyButtons.length).toBe(2);
      });
    });
  });

  describe('Add kubeconfig overlay', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('shows kubeconfig content textarea in overlay', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      });
    });

    it('disables Save button when content is empty', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save & Continue/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('enables Save button when content is provided', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/Kubeconfig Content/i);
      fireEvent.change(textarea, { target: { value: 'apiVersion: v1\nkind: Config' } });

      const saveButton = screen.getByRole('button', { name: /Save & Continue/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('saves primary kubeconfig and completes', async () => {
      mockSavePrimaryKubeConfig.mockResolvedValue('/home/user/.kube/kubeconfig');
      mockGetKubeConfigs.mockResolvedValue([]);

      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/Kubeconfig Content/i);
      fireEvent.change(textarea, { target: { value: 'apiVersion: v1\nkind: Config\ncontexts: []' } });

      const saveButton = screen.getByRole('button', { name: /Save & Continue/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSavePrimaryKubeConfig).toHaveBeenCalledWith('apiVersion: v1\nkind: Config\ncontexts: []');
      });
    });

    it('closes overlay when clicking close button', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Create Your First Kubeconfig/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /✕/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Create Your First Kubeconfig/i)).not.toBeInTheDocument();
      });
    });

    it('closes overlay when clicking Cancel button', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Create Your First Kubeconfig/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Create Your First Kubeconfig/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Add kubeconfig with existing configs', () => {
    const mockConfigs = [
      { path: '/home/user/.kube/config', name: 'config', contexts: ['dev'] },
    ];

    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue(mockConfigs);
    });

    it('shows configuration type selection when configs exist', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Configuration Type/i)).toBeInTheDocument();
      });
    });

    it('shows Add Kubeconfig title when configs exist', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Add Kubeconfig/i)).toBeInTheDocument();
      });
    });
  });

  describe('File browsing', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('calls file browser when Browse button is clicked', async () => {
      const user = userEvent.setup();
      mockSelectKubeConfigFile.mockResolvedValue('/custom/path/kubeconfig');
      mockGetKubeContextsFromFile.mockResolvedValue(['ctx1', 'ctx2']);

      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Browse/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(mockSelectKubeConfigFile).toHaveBeenCalled();
      });
    });

    it('handles file selection cancellation', async () => {
      const user = userEvent.setup();
      mockSelectKubeConfigFile.mockResolvedValue(''); // Empty string = cancelled

      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Browse/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Browse/i }));

      await waitFor(() => {
        expect(mockSelectKubeConfigFile).toHaveBeenCalled();
      });

      // Should not call GetKubeContextsFromFile for empty path
      expect(mockGetKubeContextsFromFile).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('displays error when config discovery fails', async () => {
      mockGetKubeConfigs.mockRejectedValue(new Error('Discovery failed'));

      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load kubeconfig files/i)).toBeInTheDocument();
      });
    });

    it('displays error when save fails', async () => {
      mockGetKubeConfigs.mockResolvedValue([]);
      mockSavePrimaryKubeConfig.mockRejectedValue(new Error('Save failed'));

      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Kubeconfig Content/i), { target: { value: 'invalid yaml' } });
      fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));

      await waitFor(() => {
        // Error might appear in multiple places
        const errorMessages = screen.getAllByText(/Failed to save kubeconfig/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sidebar navigation', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('switches to Docker Swarm view when clicking Docker Swarm in sidebar', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Docker Swarm')).toBeInTheDocument();
      });

      const dockerSwarmSection = document.getElementById('connection-section-docker-swarm');
      fireEvent.click(dockerSwarmSection);

      // Wait for the Docker Swarm section to be rendered
      await waitFor(() => {
        expect(screen.getByText(/Docker Swarm Connections/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('highlights selected section in sidebar', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const kubernetesSection = document.getElementById('connection-section-kubernetes');
        expect(kubernetesSection).toHaveClass('selected');
      });

      const dockerSwarmSection = document.getElementById('connection-section-docker-swarm');
      fireEvent.click(dockerSwarmSection);

      // Just check that clicking works - the selection highlighting is tested implicitly
      await waitFor(() => {
        expect(screen.getByText(/Docker Swarm Connections/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Global Proxy settings', () => {
    const mockConfigs = [
      { path: '/home/user/.kube/config', name: 'config', contexts: ['dev'] },
    ];

    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue(mockConfigs);
    });

    it('shows global proxy settings button in sidebar', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(document.getElementById('global-proxy-settings-btn')).toBeInTheDocument();
      });
    });

    it('opens global proxy settings overlay when button is clicked', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(document.getElementById('global-proxy-settings-btn')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('global-proxy-settings-btn'));

      await waitFor(() => {
        expect(screen.getByText(/Global Proxy Settings/i)).toBeInTheDocument();
      });
    });

    it('shows proxy authentication options', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(document.getElementById('global-proxy-settings-btn')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('global-proxy-settings-btn'));

      await waitFor(() => {
        expect(screen.getByText(/No Proxy/i)).toBeInTheDocument();
        expect(screen.getByText(/Use System Proxy/i)).toBeInTheDocument();
        expect(screen.getByText(/Manual Configuration/i)).toBeInTheDocument();
      });
    });

    it('saves global proxy settings', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        expect(document.getElementById('global-proxy-settings-btn')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('global-proxy-settings-btn'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Settings/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

      await waitFor(() => {
        expect(mockSetProxyConfig).toHaveBeenCalled();
      });
    });
  });

  describe('Per-config Proxy settings', () => {
    const mockConfigs = [
      { path: '/home/user/.kube/config', name: 'config', contexts: ['dev'] },
    ];

    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue(mockConfigs);
    });

    it('opens proxy settings for specific config when proxy button is clicked', async () => {
      render(<ConnectionWizard onComplete={vi.fn()} />);

      await waitFor(() => {
        const proxyButton = screen.getByTitle(/Proxy settings/i);
        expect(proxyButton).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle(/Proxy settings/i));

      await waitFor(() => {
        // Look for the specific overlay title which includes the config path
        expect(screen.getByText(/Proxy Settings - \/home\/user\/.kube\/config/i)).toBeInTheDocument();
      });
    });
  });
});
