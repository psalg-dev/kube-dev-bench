import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contextState = vi.hoisted(() => ({
  testSwarmConnection: vi.fn(),
}));

vi.mock('../layout/connection/ConnectionsStateContext', () => ({
  useConnectionsState: () => ({
    actions: {
      testSwarmConnection: contextState.testSwarmConnection,
    },
  }),
}));

import AddSwarmConnectionOverlay from '../layout/connection/AddSwarmConnectionOverlay';

describe('AddSwarmConnectionOverlay', () => {
  beforeEach(() => {
    contextState.testSwarmConnection.mockReset();
  });

  it('validates name and saves local connection after successful test', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    contextState.testSwarmConnection.mockResolvedValue({
      connected: true,
      serverVersion: '28.1',
      swarmActive: true,
    });

    render(<AddSwarmConnectionOverlay onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Connection Name'), { target: { value: 'Dev Swarm' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(contextState.testSwarmConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          tlsEnabled: false,
          tlsVerify: false,
        })
      );
    });
    expect(await screen.findByText(/Connection successful/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dev Swarm',
        tlsEnabled: false,
        serverVersion: '28.1',
        swarmActive: true,
      })
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles TLS mode fields and reports failed test results', async () => {
    contextState.testSwarmConnection.mockResolvedValue({
      connected: false,
      error: 'Access denied',
    });

    render(<AddSwarmConnectionOverlay onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByText('TCP with TLS'));

    fireEvent.change(screen.getByLabelText('Connection Name'), { target: { value: 'TLS Swarm' } });
    fireEvent.change(screen.getByLabelText('Client Certificate (PEM)'), { target: { value: 'CERT' } });
    fireEvent.change(screen.getByLabelText('Client Key (PEM)'), { target: { value: 'KEY' } });
    fireEvent.change(screen.getByLabelText('CA Certificate (PEM)'), { target: { value: 'CA' } });

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));

    await waitFor(() => {
      expect(contextState.testSwarmConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          tlsEnabled: true,
          tlsCert: 'CERT',
          tlsKey: 'KEY',
          tlsCA: 'CA',
          tlsVerify: true,
        })
      );
    });

    const matches = await screen.findAllByText(/Access denied/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('closes on escape key and close button', () => {
    const onClose = vi.fn();
    render(<AddSwarmConnectionOverlay onClose={onClose} onSuccess={vi.fn()} />);

    fireEvent.keyDown(screen.getByText('🐳 Add Docker Connection').closest('.add-swarm-overlay') as HTMLElement, {
      key: 'Escape',
    });

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
