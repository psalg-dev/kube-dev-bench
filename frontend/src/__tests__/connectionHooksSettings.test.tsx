import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConnectionsStateProvider, useConnectionsState } from '../layout/connection/ConnectionsStateContext';
import ConnectionHooksSettings from '../layout/connection/ConnectionHooksSettings';
import { genericAPIMock, resetAllMocks } from './wailsMocks';

const toUndefinedPromise = <T,>(value: T) => Promise.resolve(value) as unknown as Promise<undefined>;

type ConnectionEntry = Parameters<ReturnType<typeof useConnectionsState>['actions']['showHooksSettings']>[1];

type HarnessProps = {
  connection: ConnectionEntry;
};

function Harness({ connection }: HarnessProps) {
  const { showHooksSettings, actions } = useConnectionsState();

  useEffect(() => {
    actions.showHooksSettings(true, connection);
    // Intentionally run once: `actions` is recreated per provider render.
    // Depending on it would cause an infinite open->render->open loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showHooksSettings) return null;

  return <ConnectionHooksSettings onClose={() => actions.showHooksSettings(false)} />;
}

function renderWithProvider(ui: ReactNode) {
  return render(<ConnectionsStateProvider>{ui}</ConnectionsStateProvider>);
}

describe('ConnectionHooksSettings', () => {
  beforeEach(() => {
    resetAllMocks();

    // Default backend responses used during provider initialization.
    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetKubeConfigs') return toUndefinedPromise([]);
      if (name === 'GetProxyConfig') return toUndefinedPromise({ authType: 'none', url: '', username: '' });
      if (name === 'DetectSystemProxy') return toUndefinedPromise({});
      if (name === 'GetDefaultDockerHost') return toUndefinedPromise('');
      if (name === 'GetDockerConnectionStatus') return toUndefinedPromise({ connected: false });
      if (name === 'GetHooksConfig') return toUndefinedPromise({ hooks: [] });
      return toUndefinedPromise(undefined);
    });
  });

  it('shows applicable hooks for a connection', async () => {
    const connection = { type: 'kubernetes', name: 'cfg1', path: '/tmp/kubeconfig' } as ConnectionEntry;
    const hooks = [
      {
        id: 'h-global',
        name: 'Global pre',
        type: 'pre-connect',
        scriptPath: '/tmp/hook.sh',
        timeoutSeconds: 5,
        abortOnFailure: true,
        enabled: true,
        scope: 'global',
      },
      {
        id: 'h-conn',
        name: 'Conn pre',
        type: 'pre-connect',
        scriptPath: '/tmp/hook2.sh',
        timeoutSeconds: 5,
        abortOnFailure: false,
        enabled: true,
        scope: 'connection',
        connectionType: 'kubernetes',
        connectionId: '/tmp/kubeconfig',
      },
      {
        id: 'h-other',
        name: 'Other conn pre',
        type: 'pre-connect',
        scriptPath: '/tmp/hook3.sh',
        timeoutSeconds: 5,
        abortOnFailure: false,
        enabled: true,
        scope: 'connection',
        connectionType: 'kubernetes',
        connectionId: '/tmp/other',
      },
    ];

    genericAPIMock.mockImplementation((name) => {
      if (name === 'GetKubeConfigs') return toUndefinedPromise([]);
      if (name === 'GetProxyConfig') return toUndefinedPromise({ authType: 'none', url: '', username: '' });
      if (name === 'DetectSystemProxy') return toUndefinedPromise({});
      if (name === 'GetDefaultDockerHost') return toUndefinedPromise('');
      if (name === 'GetDockerConnectionStatus') return toUndefinedPromise({ connected: false });
      if (name === 'GetHooksConfig') return toUndefinedPromise({ hooks });
      return toUndefinedPromise(undefined);
    });

    renderWithProvider(<Harness connection={connection} />);

    // Overlay appears
    const closeBtn = await screen.findByRole('button', { name: '✕' });
    expect(closeBtn).toBeVisible();

    // Hooks list contains global + matching connection hook
    expect(await screen.findByText('Global pre')).toBeVisible();
    expect(await screen.findByText('Conn pre')).toBeVisible();
    expect(screen.queryByText('Other conn pre')).toBeNull();

    // Add button exists
    expect(screen.getByRole('button', { name: /add hook/i })).toBeVisible();
  });

  it('can add a new hook using browse and save', async () => {
    const user = userEvent.setup();

    const connection = { type: 'kubernetes', name: 'cfg1', path: '/tmp/kubeconfig' } as ConnectionEntry;

    genericAPIMock.mockImplementation((name, ...args) => {
      if (name === 'GetKubeConfigs') return toUndefinedPromise([]);
      if (name === 'GetProxyConfig') return toUndefinedPromise({ authType: 'none', url: '', username: '' });
      if (name === 'DetectSystemProxy') return toUndefinedPromise({});
      if (name === 'GetDefaultDockerHost') return toUndefinedPromise('');
      if (name === 'GetDockerConnectionStatus') return toUndefinedPromise({ connected: false });
      if (name === 'GetHooksConfig') return toUndefinedPromise({ hooks: [] });
      if (name === 'SelectHookScript') return toUndefinedPromise('/tmp/newhook.sh');
      if (name === 'SaveHook') {
        const hook = args[0] as Record<string, unknown>;
        return toUndefinedPromise({ ...hook, id: 'h-new' });
      }
      return toUndefinedPromise(undefined);
    });

    renderWithProvider(<Harness connection={connection} />);

    await user.click(await screen.findByRole('button', { name: /add hook/i }));

    await user.type(screen.getByLabelText(/name/i), 'My Hook');
    await user.click(screen.getByRole('button', { name: /browse/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/script/i)).toHaveValue('/tmp/newhook.sh');
    });

    const saveButton = await screen.findByRole('button', { name: /^(save|saving\.\.\.)$/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    await user.click(saveButton);

    // Ensure backend SaveHook called with normalized fields (type is current tab).
    await waitFor(() => {
      const saveCalls = genericAPIMock.mock.calls.filter((c) => c[0] === 'SaveHook');
      expect(saveCalls.length).toBe(1);
      expect(saveCalls[0][1]).toMatchObject({
        name: 'My Hook',
        type: 'pre-connect',
        scriptPath: '/tmp/newhook.sh',
        scope: 'connection',
        connectionType: 'kubernetes',
        connectionId: '/tmp/kubeconfig',
      });
    });
  });

  it('can test an existing hook and show results', async () => {
    const user = userEvent.setup();

    const connection = { type: 'kubernetes', name: 'cfg1', path: '/tmp/kubeconfig' } as ConnectionEntry;
    const hooks = [
      {
        id: 'h1',
        name: 'Hook 1',
        type: 'pre-connect',
        scriptPath: '/tmp/hook.sh',
        timeoutSeconds: 5,
        abortOnFailure: false,
        enabled: true,
        scope: 'global',
      },
    ];

    genericAPIMock.mockImplementation((name, ...args) => {
      if (name === 'GetKubeConfigs') return toUndefinedPromise([]);
      if (name === 'GetProxyConfig') return toUndefinedPromise({ authType: 'none', url: '', username: '' });
      if (name === 'DetectSystemProxy') return toUndefinedPromise({});
      if (name === 'GetDefaultDockerHost') return toUndefinedPromise('');
      if (name === 'GetDockerConnectionStatus') return toUndefinedPromise({ connected: false });
      if (name === 'GetHooksConfig') return toUndefinedPromise({ hooks });
      if (name === 'TestHook') {
        expect(args[0]).toBe('h1');
        return toUndefinedPromise({ success: true, exitCode: 0, stdout: 'OK', stderr: '' });
      }
      return toUndefinedPromise(undefined);
    });

    renderWithProvider(<Harness connection={connection} />);

    expect(await screen.findByText('Hook 1')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /^test$/i }));

    const resultTitle = await screen.findByText(/test result/i);
    expect(resultTitle).toBeVisible();

    expect(screen.getByText(/success/i)).toBeVisible();
    expect(screen.getByText('OK')).toBeVisible();
  });
});
