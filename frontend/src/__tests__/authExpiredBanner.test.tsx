import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Import Wails mocks (auto-mocks runtime + App)
import { appApiMocks } from './wailsMocks';

// Mock notification module
const showErrorMock = vi.fn();
const showSuccessMock = vi.fn();
vi.mock('../notification', () => ({
  showError: (...args: unknown[]) => showErrorMock(...args),
  showWarning: vi.fn(),
  showSuccess: (...args: unknown[]) => showSuccessMock(...args),
}));

import { AuthExpiredBanner } from '../layout/connection/AuthExpiredBanner';
import type { AuthExpiredPayload } from '../hooks/useEnterpriseAuthEvents';

const defaultPayload: AuthExpiredPayload = {
  context: 'prod-cluster',
  error: 'token expired',
};

describe('AuthExpiredBanner', () => {
  it('renders banner with context name', () => {
    const onDismiss = vi.fn();
    render(<AuthExpiredBanner payload={defaultPayload} onDismiss={onDismiss} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('prod-cluster')).toBeTruthy();
    expect(screen.getByText(/Authentication expired/)).toBeTruthy();
  });

  it('renders Reconnect and dismiss buttons', () => {
    const onDismiss = vi.fn();
    render(<AuthExpiredBanner payload={defaultPayload} onDismiss={onDismiss} />);

    expect(screen.getByText('Reconnect')).toBeTruthy();
    expect(screen.getByLabelText('Dismiss')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<AuthExpiredBanner payload={defaultPayload} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls RefreshCredentials on Reconnect and dismisses on success', async () => {
    appApiMocks['RefreshCredentials'].mockResolvedValueOnce(undefined);

    const onDismiss = vi.fn();
    const onReconnect = vi.fn();
    render(
      <AuthExpiredBanner
        payload={defaultPayload}
        onDismiss={onDismiss}
        onReconnect={onReconnect}
      />,
    );

    fireEvent.click(screen.getByText('Reconnect'));

    await waitFor(() => {
      expect(appApiMocks['RefreshCredentials']).toHaveBeenCalledWith('prod-cluster');
    });

    await waitFor(() => {
      expect(showSuccessMock).toHaveBeenCalledWith(
        expect.stringContaining('Credentials refreshed'),
      );
      expect(onReconnect).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error notification when RefreshCredentials fails', async () => {
    appApiMocks['RefreshCredentials'].mockRejectedValueOnce(
      new Error('OIDC provider unreachable'),
    );

    const onDismiss = vi.fn();
    render(<AuthExpiredBanner payload={defaultPayload} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('Reconnect'));

    await waitFor(() => {
      expect(showErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('OIDC provider unreachable'),
      );
    });
    // Should NOT dismiss on error
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('disables buttons while loading', async () => {
    let resolveRefresh!: () => void;
    appApiMocks['RefreshCredentials'].mockReturnValueOnce(
      new Promise<void>((resolve) => { resolveRefresh = resolve; }),
    );

    const onDismiss = vi.fn();
    render(<AuthExpiredBanner payload={defaultPayload} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('Reconnect'));

    await waitFor(() => {
      expect(screen.getByText('Refreshing…')).toBeTruthy();
    });
    expect(screen.getByLabelText('Dismiss').closest('button')?.disabled).toBe(true);

    // Clean up
    resolveRefresh();
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
