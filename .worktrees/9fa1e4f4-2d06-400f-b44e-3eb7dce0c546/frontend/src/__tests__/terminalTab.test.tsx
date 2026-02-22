import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appApiMocks, resetAllMocks } from './wailsMocks';

const terminalState = vi.hoisted(() => {
  const instances: Array<{
    cols: number;
    rows: number;
    loadAddon: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    writeln: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    onResize: ReturnType<typeof vi.fn>;
    _onData?: (_data: string) => void;
    _onResize?: (_size: { cols: number; rows: number }) => void;
  }> = [];
  return { instances };
});

const runtimeState = vi.hoisted(() => {
  const handlers = new Map<string, (_payload: unknown) => void>();
  const offFns: ReturnType<typeof vi.fn>[] = [];
  return { handlers, offFns };
});

vi.mock('xterm/css/xterm.css', () => ({}));

vi.mock('xterm', () => ({
  Terminal: class TerminalMock {
    cols = 120;
    rows = 40;
    loadAddon = vi.fn();
    open = vi.fn();
    write = vi.fn();
    writeln = vi.fn();
    dispose = vi.fn();
    _onData?: (_data: string) => void;
    _onResize?: (_size: { cols: number; rows: number }) => void;

    constructor() {
      terminalState.instances.push(this);
    }

    onData = vi.fn((cb: (_data: string) => void) => {
      this._onData = cb;
      return { dispose: vi.fn() };
    });

    onResize = vi.fn((cb: (_size: { cols: number; rows: number }) => void) => {
      this._onResize = cb;
      return { dispose: vi.fn() };
    });
  },
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: class FitAddonMock {
    fit = vi.fn();
  },
}));

vi.mock('../../wailsjs/runtime', () => ({
  EventsOn: vi.fn((eventName: string, handler: (_payload: unknown) => void) => {
    runtimeState.handlers.set(eventName, handler);
    const off = vi.fn(() => runtimeState.handlers.delete(eventName));
    runtimeState.offFns.push(off);
    return off;
  }),
}));

import TerminalTab from '../layout/bottompanel/TerminalTab';

describe('TerminalTab', () => {
  beforeEach(() => {
    resetAllMocks();
    terminalState.instances.length = 0;
    runtimeState.handlers.clear();
    runtimeState.offFns.length = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('session-123');
    appApiMocks.StartShellSession.mockResolvedValue(undefined);
    appApiMocks.StartPodExecSession.mockResolvedValue(undefined);
    appApiMocks.StartSwarmTaskExecSession.mockResolvedValue(undefined);
    appApiMocks.SendShellInput.mockResolvedValue(undefined);
    appApiMocks.ResizeShellSession.mockResolvedValue(undefined);
    appApiMocks.StopShellSession.mockResolvedValue(undefined);
  });

  it('starts a shell session, handles stream events, and cleans up on unmount', async () => {
    const { unmount } = render(<TerminalTab command="pwd" />);

    await waitFor(() => {
      expect(appApiMocks.StartShellSession).toHaveBeenCalledWith('session-123', 'pwd');
    });

    const instance = terminalState.instances.at(-1);
    expect(instance).toBeDefined();

    runtimeState.handlers.get('terminal:session-123:output')?.('hello');
    expect(instance?.write).toHaveBeenCalledWith('hello');

    runtimeState.handlers.get('terminal:session-123:exit')?.('done');
    expect(instance?.writeln).toHaveBeenCalledWith('\r\ndone');

    instance?._onData?.('ls\n');
    await waitFor(() => {
      expect(appApiMocks.SendShellInput).toHaveBeenCalledWith('session-123', 'ls\n');
    });

    instance?._onResize?.({ cols: 90, rows: 30 });
    await waitFor(() => {
      expect(appApiMocks.ResizeShellSession).toHaveBeenCalledWith('session-123', 90, 30);
    });

    unmount();

    await waitFor(() => {
      expect(appApiMocks.StopShellSession).toHaveBeenCalledWith('session-123');
    });
    expect(runtimeState.offFns.length).toBeGreaterThan(0);
    for (const off of runtimeState.offFns) {
      expect(off).toHaveBeenCalled();
    }
  });

  it('uses pod exec path with default auto shell', async () => {
    render(<TerminalTab podExec namespace="ns" podName="pod-1" shell="  " />);

    await waitFor(() => {
      expect(appApiMocks.StartPodExecSession).toHaveBeenCalledWith('session-123', 'ns', 'pod-1', 'auto');
    });
    expect(appApiMocks.StartShellSession).not.toHaveBeenCalled();
  });

  it('uses swarm exec path and prints errors from startup failure', async () => {
    appApiMocks.StartSwarmTaskExecSession.mockRejectedValueOnce(new Error('boom'));

    render(<TerminalTab swarmExec swarmTaskId="task-1" shell="sh" />);

    const instance = terminalState.instances.at(-1);
    await waitFor(() => {
      expect(appApiMocks.StartSwarmTaskExecSession).toHaveBeenCalledWith('session-123', 'task-1', 'sh');
    });

    await waitFor(() => {
      expect(instance?.write).toHaveBeenCalledWith('\r\nSwarm exec error: boom\r\n');
    });
  });
});
