import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SwarmStateContextValue } from '../docker/SwarmStateContext';

vi.mock('../docker/SwarmStateContext', () => ({
  useSwarmState: vi.fn(),
}));

describe('SwarmConnectionWizard', () => {
  function setNavigatorPlatform(value: string) {
    const original = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      value,
      configurable: true,
    });
    return () => {
      Object.defineProperty(navigator, 'platform', {
        value: original,
        configurable: true,
      });
    };
  }

  it('defaults to local socket and picks Windows default host', async () => {
    const restore = setNavigatorPlatform('Win32');

    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({
      loading: false,
      config: null,
      actions: {
        testConnection: vi.fn(),
        connect: vi.fn(),
        closeWizard: vi.fn(),
      },
    } as unknown as SwarmStateContextValue);

    const { default: SwarmConnectionWizard } = await import('../docker/SwarmConnectionWizard');

    render(<SwarmConnectionWizard />);

    const hostInput = await screen.findByRole('textbox');
    expect((hostInput as HTMLInputElement).value).toBe('npipe:////./pipe/docker_engine');

    restore();
  });

  it('switches between local/tcp/tls and toggles TLS fields', async () => {
    const restore = setNavigatorPlatform('Linux x86_64');

    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({
      loading: false,
      config: null,
      actions: {
        testConnection: vi.fn(),
        connect: vi.fn(),
        closeWizard: vi.fn(),
      },
    } as unknown as SwarmStateContextValue);

    const { default: SwarmConnectionWizard } = await import('../docker/SwarmConnectionWizard');

    render(<SwarmConnectionWizard />);

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);

    // local
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('unix:///var/run/docker.sock');
    expect(screen.queryByPlaceholderText('/path/to/ca.pem')).not.toBeInTheDocument();

    // tcp
    fireEvent.click(radios[1]);
    expect((screen.getByPlaceholderText('tcp://hostname:port') as HTMLInputElement).value).toBe('tcp://localhost:2375');
    expect(screen.queryByPlaceholderText('/path/to/ca.pem')).not.toBeInTheDocument();

    // tls
    fireEvent.click(radios[2]);
    expect((screen.getByPlaceholderText('tcp://hostname:port') as HTMLInputElement).value).toBe('tcp://localhost:2376');
    expect(await screen.findByPlaceholderText('/path/to/ca.pem')).toBeInTheDocument();

    restore();
  });

  it('tests connection and renders success details (including truncated node id)', async () => {
    const restore = setNavigatorPlatform('Linux x86_64');

    const testConnection = vi.fn().mockResolvedValue({
      connected: true,
      serverVersion: 'Docker 25.0',
      swarmActive: true,
      isManager: true,
      nodeId: 'abcdef1234567890',
    });

    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({
      loading: false,
      config: null,
      actions: {
        testConnection,
        connect: vi.fn(),
        closeWizard: vi.fn(),
      },
    } as unknown as SwarmStateContextValue);

    const { default: SwarmConnectionWizard } = await import('../docker/SwarmConnectionWizard');

    render(<SwarmConnectionWizard />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    expect(await screen.findByText(/Connection Successful/i)).toBeInTheDocument();
    expect(screen.getByText('Docker Version: Docker 25.0')).toBeInTheDocument();
    expect(screen.getByText('Swarm Active: Yes')).toBeInTheDocument();
    expect(screen.getByText('Manager Node: Yes')).toBeInTheDocument();
    expect(screen.getByText('Node ID: abcdef123456...')).toBeInTheDocument();

    await waitFor(() => {
      expect(testConnection).toHaveBeenCalledTimes(1);
    });

    restore();
  });

  it('shows error when connection test fails', async () => {
    const restore = setNavigatorPlatform('Linux x86_64');

    const testConnection = vi.fn().mockResolvedValue({ connected: false, error: 'bad cert' });

    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({
      loading: false,
      config: null,
      actions: {
        testConnection,
        connect: vi.fn(),
        closeWizard: vi.fn(),
      },
    } as unknown as SwarmStateContextValue);

    const { default: SwarmConnectionWizard } = await import('../docker/SwarmConnectionWizard');

    render(<SwarmConnectionWizard />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    expect(await screen.findAllByText('bad cert')).not.toHaveLength(0);

    restore();
  });

  it('connects successfully and calls onComplete; Skip closes wizard', async () => {
    const restore = setNavigatorPlatform('Linux x86_64');

    const onComplete = vi.fn();
    const connect = vi.fn().mockResolvedValue({ connected: true });
    const closeWizard = vi.fn();

    const swarmState = await import('../docker/SwarmStateContext');
    const useSwarmStateMock = vi.mocked(swarmState.useSwarmState);
    useSwarmStateMock.mockReturnValue({
      loading: false,
      config: null,
      actions: {
        testConnection: vi.fn(),
        connect,
        closeWizard,
      },
    } as unknown as SwarmStateContextValue);

    const { default: SwarmConnectionWizard } = await import('../docker/SwarmConnectionWizard');

    render(<SwarmConnectionWizard onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(connect).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(closeWizard).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(2);

    restore();
  });
});
