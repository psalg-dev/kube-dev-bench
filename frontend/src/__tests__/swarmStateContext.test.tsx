import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the swarm API
vi.mock('../docker/swarmApi', () => ({
  GetDockerConnectionStatus: vi.fn(() => Promise.resolve({ connected: false })),
  ConnectToDocker: vi.fn(() => Promise.resolve({ connected: true, serverVersion: '24.0.0', swarmActive: true })),
  TestDockerConnection: vi.fn(() => Promise.resolve({ connected: true, serverVersion: '24.0.0', swarmActive: true })),
  DisconnectDocker: vi.fn(() => Promise.resolve()),
  GetDockerConfig: vi.fn(() => Promise.resolve(null)),
  AutoConnectDocker: vi.fn(() => Promise.resolve({ connected: false })),
  GetSwarmServices: vi.fn(() => Promise.resolve([])),
  GetSwarmTasks: vi.fn(() => Promise.resolve([])),
  GetSwarmNodes: vi.fn(() => Promise.resolve([])),
  GetSwarmNetworks: vi.fn(() => Promise.resolve([])),
  GetSwarmConfigs: vi.fn(() => Promise.resolve([])),
  GetSwarmSecrets: vi.fn(() => Promise.resolve([])),
  GetSwarmStacks: vi.fn(() => Promise.resolve([])),
  GetSwarmVolumes: vi.fn(() => Promise.resolve([])),
}));

// Mock wails runtime
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsOn: vi.fn(() => () => {}),
  EventsOff: vi.fn(),
}));

// Mock notifications
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn(),
}));

import type { docker } from '../../wailsjs/go/models';
import * as swarmApi from '../docker/swarmApi';
import type { SwarmStateContextValue } from '../docker/SwarmStateContext';
import { SwarmStateProvider, useSwarmState } from '../docker/SwarmStateContext';
import * as notification from '../notification';
type SwarmStateValue = SwarmStateContextValue | null;

const dockerConfig: docker.DockerConfig = {
  host: 'unix:///var/run/docker.sock',
  tlsEnabled: false,
  tlsCert: '',
  tlsKey: '',
  tlsCA: '',
  tlsVerify: false,
};

// Test component to access context
function TestConsumer({ onRender }: { onRender?: (_state: SwarmStateValue) => void }) {
  const state = useSwarmState();
  useEffect(() => {
    if (onRender) {
      onRender(state);
    }
  }, [onRender, state]);
  return (
    <div>
      <span data-testid="connected">{String(state?.connected)}</span>
      <span data-testid="swarmActive">{String(state?.swarmActive)}</span>
      <span data-testid="showWizard">{String(state?.showWizard)}</span>
      <span data-testid="initialized">{String(state?.initialized)}</span>
      <button onClick={() => state?.actions.openWizard()}>Open Wizard</button>
      <button onClick={() => state?.actions.closeWizard()}>Close Wizard</button>
      <button onClick={() => state?.actions.connect(dockerConfig)}>Connect</button>
      <button onClick={() => state?.actions.disconnect()}>Disconnect</button>
    </div>
  );
}

describe('SwarmStateContext', () => {
  const showSuccessMock = vi.mocked(notification.showSuccess);
  const autoConnectDockerMock = vi.mocked(swarmApi.AutoConnectDocker);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', async () => {
    render(
      <SwarmStateProvider>
        <TestConsumer />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.getByTestId('swarmActive').textContent).toBe('false');
    expect(screen.getByTestId('showWizard').textContent).toBe('false');
  });

  it('opens and closes wizard', async () => {
    render(
      <SwarmStateProvider>
        <TestConsumer />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    expect(screen.getByTestId('showWizard').textContent).toBe('false');

    fireEvent.click(screen.getByText('Open Wizard'));
    expect(screen.getByTestId('showWizard').textContent).toBe('true');

    fireEvent.click(screen.getByText('Close Wizard'));
    expect(screen.getByTestId('showWizard').textContent).toBe('false');
  });

  it('connects to Docker successfully', async () => {
    render(
      <SwarmStateProvider>
        <TestConsumer />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Connect'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    expect(screen.getByTestId('swarmActive').textContent).toBe('true');
    expect(showSuccessMock).toHaveBeenCalled();
  });

  it('disconnects from Docker', async () => {
    // Setup: first connect
    autoConnectDockerMock.mockResolvedValueOnce({
      connected: true,
      swarmActive: true,
      serverVersion: '24.0.0',
      nodeId: 'node-1',
      isManager: true,
      error: '',
    });

    render(
      <SwarmStateProvider>
        <TestConsumer />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Disconnect'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('false');
    });

    expect(showSuccessMock).toHaveBeenCalledWith('Disconnected from Docker');
  });

  it('returns null when used outside provider', async () => {
    let capturedState: SwarmStateValue = 'not-set' as unknown as SwarmStateValue;
    const TestNullConsumer = () => {
      const state = useSwarmState();
      useEffect(() => {
        capturedState = state;
      }, [state]);
      return <div>Test</div>;
    };

    render(<TestNullConsumer />);

    await waitFor(() => {
      expect(capturedState).toBeNull();
    });
  });

  it('provides resource refresh functions', async () => {
    let capturedState: SwarmStateValue = null;
    render(
      <SwarmStateProvider>
        <TestConsumer onRender={(state) => { capturedState = state; }} />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    if (!capturedState) {
      throw new Error('Expected swarm state to be available within provider.');
    }
    const state = capturedState as SwarmStateContextValue;
    expect(typeof state.refreshServices).toBe('function');
    expect(typeof state.refreshTasks).toBe('function');
    expect(typeof state.refreshNodes).toBe('function');
    expect(typeof state.refreshNetworks).toBe('function');
    expect(typeof state.refreshConfigs).toBe('function');
    expect(typeof state.refreshSecrets).toBe('function');
    expect(typeof state.refreshStacks).toBe('function');
    expect(typeof state.refreshVolumes).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Extended tests: reconnect, polling via EventsOn, and refresh functions
// ──────────────────────────────────────────────

describe('SwarmStateContext – reconnect & polling', () => {
  const getDockerConnectionStatusMock = vi.mocked(swarmApi.GetDockerConnectionStatus);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshConnectionStatus updates connected state', async () => {
    // Initially not connected; after refresh, connected
    getDockerConnectionStatusMock.mockResolvedValue({
      connected: true,
      swarmActive: true,
      serverVersion: '24.0.0',
      nodeId: 'node-1',
      isManager: true,
      error: '',
    });

    let capturedState: SwarmStateValue = null;
    render(
      <SwarmStateProvider>
        <TestConsumer onRender={(s) => { capturedState = s; }} />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    await act(async () => {
      await (capturedState as SwarmStateContextValue)?.actions.refreshConnectionStatus();
    });

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('true');
    });
  });

  it('refreshServices fetches and updates services list', async () => {
    const mockServices = [{ ID: 'svc-1', Spec: { Name: 'web' } }];
    vi.mocked(swarmApi.GetSwarmServices).mockResolvedValue(mockServices as unknown as Awaited<ReturnType<typeof swarmApi.GetSwarmServices>>);

    let capturedState: SwarmStateValue = null;
    render(
      <SwarmStateProvider>
        <TestConsumer onRender={(s) => { capturedState = s; }} />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    await act(async () => {
      await (capturedState as SwarmStateContextValue)?.refreshServices();
    });

    await waitFor(() => {
      expect(vi.mocked(swarmApi.GetSwarmServices)).toHaveBeenCalled();
    });
  });

  it('connect shows error when connection fails', async () => {
    vi.mocked(swarmApi.ConnectToDocker).mockResolvedValue({
      connected: false,
      swarmActive: false,
      serverVersion: '',
      nodeId: '',
      isManager: false,
      error: 'connection refused',
    });

    render(
      <SwarmStateProvider>
        <TestConsumer />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Connect'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('connected').textContent).toBe('false');
    });

    expect(vi.mocked(notification.showError)).toHaveBeenCalledWith(
      expect.stringContaining('Failed to connect')
    );
  });

  it('testConnection calls TestDockerConnection API', async () => {
    vi.mocked(swarmApi.TestDockerConnection).mockResolvedValue({
      connected: true,
      swarmActive: true,
      serverVersion: '24.0.0',
      nodeId: 'node-1',
      isManager: true,
      error: '',
    });

    let capturedState: SwarmStateValue = null;
    render(
      <SwarmStateProvider>
        <TestConsumer onRender={(s) => { capturedState = s; }} />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    const config = dockerConfig;
    await act(async () => {
      await (capturedState as SwarmStateContextValue)?.actions.testConnection(config);
    });

    expect(vi.mocked(swarmApi.TestDockerConnection)).toHaveBeenCalledWith(config);
  });

  it('refreshNodes calls GetSwarmNodes and updates nodes', async () => {
    const mockNodes = [{ ID: 'node-1', Status: { State: 'ready' } }];
    vi.mocked(swarmApi.GetSwarmNodes).mockResolvedValue(mockNodes as unknown as Awaited<ReturnType<typeof swarmApi.GetSwarmNodes>>);

    let capturedState: SwarmStateValue = null;
    render(
      <SwarmStateProvider>
        <TestConsumer onRender={(s) => { capturedState = s; }} />
      </SwarmStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    await act(async () => {
      await (capturedState as SwarmStateContextValue)?.refreshNodes();
    });

    expect(vi.mocked(swarmApi.GetSwarmNodes)).toHaveBeenCalled();
  });
});
