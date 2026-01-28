import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

// Mock the swarm API
vi.mock('../docker/swarmApi.js', () => ({
  GetDockerConnectionStatus: vi.fn(() => Promise.resolve({ connected: false })),
  ConnectToDocker: vi.fn(() =>
    Promise.resolve({
      connected: true,
      serverVersion: '24.0.0',
      swarmActive: true,
    }),
  ),
  TestDockerConnection: vi.fn(() =>
    Promise.resolve({
      connected: true,
      serverVersion: '24.0.0',
      swarmActive: true,
    }),
  ),
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
vi.mock('../notification.js', () => ({
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn(),
}));

import {
  SwarmStateProvider,
  useSwarmState,
} from '../docker/SwarmStateContext.jsx';
import * as swarmApi from '../docker/swarmApi.js';
import * as notification from '../notification.js';

// Test component to access context
function TestConsumer({ onRender }) {
  const state = useSwarmState();
  onRender?.(state);
  return (
    <div>
      <span data-testid="connected">{String(state.connected)}</span>
      <span data-testid="swarmActive">{String(state.swarmActive)}</span>
      <span data-testid="showWizard">{String(state.showWizard)}</span>
      <span data-testid="initialized">{String(state.initialized)}</span>
      <button onClick={() => state.actions.openWizard()}>Open Wizard</button>
      <button onClick={() => state.actions.closeWizard()}>Close Wizard</button>
      <button
        onClick={() =>
          state.actions.connect({ host: 'unix:///var/run/docker.sock' })
        }
      >
        Connect
      </button>
      <button onClick={() => state.actions.disconnect()}>Disconnect</button>
    </div>
  );
}

describe('SwarmStateContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', async () => {
    let _capturedState;
    render(
      <SwarmStateProvider>
        <TestConsumer
          onRender={(state) => {
            _capturedState = state;
          }}
        />
      </SwarmStateProvider>,
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
      </SwarmStateProvider>,
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
      </SwarmStateProvider>,
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
    expect(notification.showSuccess).toHaveBeenCalled();
  });

  it('disconnects from Docker', async () => {
    // Setup: first connect
    swarmApi.AutoConnectDocker.mockResolvedValueOnce({
      connected: true,
      swarmActive: true,
      serverVersion: '24.0.0',
    });

    render(
      <SwarmStateProvider>
        <TestConsumer />
      </SwarmStateProvider>,
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

    expect(notification.showSuccess).toHaveBeenCalledWith(
      'Disconnected from Docker',
    );
  });

  it('returns null when used outside provider', () => {
    let capturedState = 'not-set';
    const TestNullConsumer = () => {
      capturedState = useSwarmState();
      return <div>Test</div>;
    };

    render(<TestNullConsumer />);

    expect(capturedState).toBeNull();
  });

  it('provides resource refresh functions', async () => {
    let capturedState;
    render(
      <SwarmStateProvider>
        <TestConsumer
          onRender={(state) => {
            capturedState = state;
          }}
        />
      </SwarmStateProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized').textContent).toBe('true');
    });

    expect(typeof capturedState.refreshServices).toBe('function');
    expect(typeof capturedState.refreshTasks).toBe('function');
    expect(typeof capturedState.refreshNodes).toBe('function');
    expect(typeof capturedState.refreshNetworks).toBe('function');
    expect(typeof capturedState.refreshConfigs).toBe('function');
    expect(typeof capturedState.refreshSecrets).toBe('function');
    expect(typeof capturedState.refreshStacks).toBe('function');
    expect(typeof capturedState.refreshVolumes).toBe('function');
  });
});
