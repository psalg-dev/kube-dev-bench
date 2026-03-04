import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Import the centralized Wails mocks – this auto-mocks the runtime + App modules
import { eventsOnMock, triggerRuntimeEvent } from './wailsMocks';

// Mock notification module (standard pattern in this project)
const showErrorMock = vi.fn();
const showWarningMock = vi.fn();
vi.mock('../notification', () => ({
  showError: (...args: unknown[]) => showErrorMock(...args),
  showWarning: (...args: unknown[]) => showWarningMock(...args),
  showSuccess: vi.fn(),
}));

import { useEnterpriseAuthEvents } from '../hooks/useEnterpriseAuthEvents';
import type {
  TLSCertErrorPayload,
  AuthExpiredPayload,
  ExecNotFoundPayload,
  ProxyAuthPayload,
} from '../hooks/useEnterpriseAuthEvents';

beforeEach(() => {
  vi.useFakeTimers();
  showErrorMock.mockReset();
  showWarningMock.mockReset();
  eventsOnMock.mockReset();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('useEnterpriseAuthEvents', () => {
  it('starts with clean state', () => {
    const { result } = renderHook(() => useEnterpriseAuthEvents());
    expect(result.current.tlsCertError).toBeNull();
    expect(result.current.authExpired).toBeNull();
  });

  it('subscribes to all 5 expected events on mount', () => {
    renderHook(() => useEnterpriseAuthEvents());

    const eventNames = eventsOnMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(eventNames).toContain('connection:tls-cert-error');
    expect(eventNames).toContain('connection:auth-expired');
    expect(eventNames).toContain('session:auth-expired');
    expect(eventNames).toContain('connection:exec-provider-not-found');
    expect(eventNames).toContain('connection:proxy-auth-required');
  });

  // ─── TLS Cert Error (Gap 2) ───

  it('sets tlsCertError on connection:tls-cert-error event', () => {
    const { result } = renderHook(() => useEnterpriseAuthEvents());

    const payload: TLSCertErrorPayload = {
      host: 'api.example.com',
      context: 'prod-cluster',
      error: 'x509: certificate signed by unknown authority',
    };

    act(() => {
      triggerRuntimeEvent('connection:tls-cert-error', payload);
    });

    expect(result.current.tlsCertError).toEqual(payload);
  });

  it('dismissTlsCertError clears tlsCertError', () => {
    const { result } = renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('connection:tls-cert-error', {
        host: 'h', context: 'c', error: 'e',
      } as TLSCertErrorPayload);
    });
    expect(result.current.tlsCertError).not.toBeNull();

    act(() => {
      result.current.dismissTlsCertError();
    });
    expect(result.current.tlsCertError).toBeNull();
  });

  // ─── Auth Expired (Gap 3) ───

  it('sets authExpired on connection:auth-expired event', () => {
    const { result } = renderHook(() => useEnterpriseAuthEvents());

    const payload: AuthExpiredPayload = { context: 'prod', error: 'token expired' };

    act(() => {
      triggerRuntimeEvent('connection:auth-expired', payload);
    });

    expect(result.current.authExpired).toEqual(payload);
    expect(showWarningMock).toHaveBeenCalledWith(
      expect.stringContaining('Authentication expired'),
    );
  });

  it('sets authExpired on session:auth-expired event', () => {
    const { result } = renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('session:auth-expired', {
        context: 'live', error: 'session token expired',
      } as AuthExpiredPayload);
    });

    expect(result.current.authExpired).toEqual({
      context: 'live', error: 'session token expired',
    });
  });

  it('dismissAuthExpired clears authExpired', () => {
    const { result } = renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('connection:auth-expired', {
        context: 'c', error: 'e',
      } as AuthExpiredPayload);
    });
    expect(result.current.authExpired).not.toBeNull();

    act(() => {
      result.current.dismissAuthExpired();
    });
    expect(result.current.authExpired).toBeNull();
  });

  // ─── Exec Not Found (Gap 5) ───

  it('shows error notification for exec-provider-not-found', () => {
    renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('connection:exec-provider-not-found', {
        binary: 'kubelogin',
        context: 'aks',
        error: 'not found',
      } as ExecNotFoundPayload);
    });

    expect(showErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('kubelogin'),
    );
  });

  it('deduplicates exec-not-found toasts for same binary', () => {
    renderHook(() => useEnterpriseAuthEvents());

    const payload: ExecNotFoundPayload = {
      binary: 'kubelogin', context: 'aks', error: 'not found',
    };

    act(() => {
      triggerRuntimeEvent('connection:exec-provider-not-found', payload);
    });
    act(() => {
      triggerRuntimeEvent('connection:exec-provider-not-found', payload);
    });

    // Only one call for "kubelogin" despite two events
    expect(showErrorMock).toHaveBeenCalledTimes(1);
  });

  // ─── Proxy Auth (Gap 6) ───

  it('shows warning for proxy-auth-required', () => {
    renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('connection:proxy-auth-required', {
        context: 'corp', error: '407',
      } as ProxyAuthPayload);
    });

    expect(showWarningMock).toHaveBeenCalledWith(
      expect.stringContaining('proxy'),
    );
  });

  it('throttles proxy-auth-required toasts within 30s window', () => {
    renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('connection:proxy-auth-required', {
        context: 'corp', error: '407',
      } as ProxyAuthPayload);
    });

    // Second trigger within 30s should be throttled
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => {
      triggerRuntimeEvent('connection:proxy-auth-required', {
        context: 'corp', error: '407 again',
      } as ProxyAuthPayload);
    });

    // Only 1 proxy warning despite two events
    expect(showWarningMock).toHaveBeenCalledTimes(1);
  });

  it('allows proxy toast after 30s cooldown', () => {
    renderHook(() => useEnterpriseAuthEvents());

    act(() => {
      triggerRuntimeEvent('connection:proxy-auth-required', {
        context: 'corp', error: '407',
      } as ProxyAuthPayload);
    });

    // Advance past cooldown
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    act(() => {
      triggerRuntimeEvent('connection:proxy-auth-required', {
        context: 'corp', error: '407 again',
      } as ProxyAuthPayload);
    });

    expect(showWarningMock).toHaveBeenCalledTimes(2);
  });
});
