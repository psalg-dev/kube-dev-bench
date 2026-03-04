import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Import Wails mocks (auto-mocks runtime + App)
import { appApiMocks } from './wailsMocks';

// Mock notification module
const showErrorMock = vi.fn();
const showWarningMock = vi.fn();
vi.mock('../notification', () => ({
  showError: (...args: unknown[]) => showErrorMock(...args),
  showWarning: (...args: unknown[]) => showWarningMock(...args),
  showSuccess: vi.fn(),
}));

import { TLSCertErrorDialog } from '../layout/connection/TLSCertErrorDialog';
import type { TLSCertErrorPayload } from '../hooks/useEnterpriseAuthEvents';

const defaultPayload: TLSCertErrorPayload = {
  host: 'api.example.com',
  context: 'prod-cluster',
  error: 'x509: certificate signed by unknown authority',
};

beforeEach(() => {
  showErrorMock.mockReset();
  showWarningMock.mockReset();
});

describe('TLSCertErrorDialog', () => {
  it('renders dialog with host and context info', () => {
    const onDismiss = vi.fn();
    render(<TLSCertErrorDialog payload={defaultPayload} onDismiss={onDismiss} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('TLS Certificate Error')).toBeTruthy();
    expect(screen.getByText('api.example.com')).toBeTruthy();
    expect(screen.getByText('prod-cluster')).toBeTruthy();
  });

  it('shows technical details in expandable section', () => {
    const onDismiss = vi.fn();
    render(<TLSCertErrorDialog payload={defaultPayload} onDismiss={onDismiss} />);

    expect(screen.getByText('Technical details')).toBeTruthy();
    expect(screen.getByText(defaultPayload.error)).toBeTruthy();
  });

  it('renders 3 action buttons', () => {
    const onDismiss = vi.fn();
    render(<TLSCertErrorDialog payload={defaultPayload} onDismiss={onDismiss} />);

    expect(screen.getByText('Add CA Certificate')).toBeTruthy();
    expect(screen.getByText('Connect Anyway (Insecure)')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onDismiss when Cancel is clicked', () => {
    const onDismiss = vi.fn();
    render(<TLSCertErrorDialog payload={defaultPayload} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onAddCA and onDismiss when Add CA Certificate is clicked', () => {
    const onDismiss = vi.fn();
    const onAddCA = vi.fn();
    render(
      <TLSCertErrorDialog
        payload={defaultPayload}
        onDismiss={onDismiss}
        onAddCA={onAddCA}
      />,
    );

    fireEvent.click(screen.getByText('Add CA Certificate'));
    expect(onAddCA).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls ConnectInsecure and dismisses on success', async () => {
    // Mock ConnectInsecure to resolve successfully
    appApiMocks['ConnectInsecure'].mockResolvedValueOnce(undefined);

    const onDismiss = vi.fn();
    const onInsecureConnected = vi.fn();
    render(
      <TLSCertErrorDialog
        payload={defaultPayload}
        onDismiss={onDismiss}
        onInsecureConnected={onInsecureConnected}
      />,
    );

    fireEvent.click(screen.getByText('Connect Anyway (Insecure)'));

    await waitFor(() => {
      expect(appApiMocks['ConnectInsecure']).toHaveBeenCalledWith('prod-cluster');
    });

    await waitFor(() => {
      expect(showWarningMock).toHaveBeenCalledWith(
        expect.stringContaining('TLS verification disabled'),
      );
      expect(onInsecureConnected).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error notification when ConnectInsecure fails', async () => {
    appApiMocks['ConnectInsecure'].mockRejectedValueOnce(
      new Error('connection refused'),
    );

    const onDismiss = vi.fn();
    render(<TLSCertErrorDialog payload={defaultPayload} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('Connect Anyway (Insecure)'));

    await waitFor(() => {
      expect(showErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('connection refused'),
      );
    });
    // Should NOT dismiss on error
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('disables buttons while loading', async () => {
    // Make ConnectInsecure hang
    let resolveConnect!: () => void;
    appApiMocks['ConnectInsecure'].mockReturnValueOnce(
      new Promise<void>((resolve) => { resolveConnect = resolve; }),
    );

    const onDismiss = vi.fn();
    render(<TLSCertErrorDialog payload={defaultPayload} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('Connect Anyway (Insecure)'));

    // While loading, all buttons should be disabled
    await waitFor(() => {
      expect(screen.getByText('Connecting…')).toBeTruthy();
    });
    expect(screen.getByText('Add CA Certificate').closest('button')?.disabled).toBe(true);
    expect(screen.getByText('Cancel').closest('button')?.disabled).toBe(true);

    // Resolve to clean up
    resolveConnect();
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
