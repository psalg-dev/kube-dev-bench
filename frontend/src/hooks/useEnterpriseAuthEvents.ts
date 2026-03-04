/**
 * useEnterpriseAuthEvents — Subscribes to GA 1-7 backend events and surfaces
 * them as actionable notifications, banners, or confirmation dialogs.
 *
 * Events handled:
 *   connection:tls-cert-error     → TLS cert verification failure (prompt user)
 *   connection:auth-expired       → Auth expired during connect
 *   session:auth-expired          → Auth expired during live session
 *   connection:exec-provider-not-found → exec credential binary missing
 *   connection:proxy-auth-required → 407 from corporate proxy
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { showError, showWarning } from '../notification';

// ────────────────── Types ──────────────────

export interface TLSCertErrorPayload {
  host: string;
  context: string;
  error: string;
}

export interface AuthExpiredPayload {
  context: string;
  error: string;
}

export interface ExecNotFoundPayload {
  binary: string;
  context: string;
  error: string;
}

export interface ProxyAuthPayload {
  context: string;
  error: string;
}

export interface EnterpriseAuthState {
  /** Non-null when a TLS cert error is pending user consent. */
  tlsCertError: TLSCertErrorPayload | null;
  /** Non-null when the session or connection auth has expired. */
  authExpired: AuthExpiredPayload | null;
}

// ────────────────── Hook ──────────────────

export function useEnterpriseAuthEvents() {
  const [state, setState] = useState<EnterpriseAuthState>({
    tlsCertError: null,
    authExpired: null,
  });

  // Notification dedup — avoid showing the same exec-not-found / proxy toast repeatedly
  const lastExecToast = useRef<string>('');
  const lastProxyToast = useRef<number>(0);

  // –––––––––– TLS cert error (Gap 2) ––––––––––
  const handleTlsCertError = useCallback((payload: TLSCertErrorPayload) => {
    setState((prev) => ({ ...prev, tlsCertError: payload }));
  }, []);

  const dismissTlsCertError = useCallback(() => {
    setState((prev) => ({ ...prev, tlsCertError: null }));
  }, []);

  // –––––––––– Auth expired (Gap 3) ––––––––––
  const handleAuthExpired = useCallback((payload: AuthExpiredPayload) => {
    setState((prev) => ({ ...prev, authExpired: payload }));
    showWarning(`Authentication expired for context "${payload.context}". Please reconnect.`);
  }, []);

  const dismissAuthExpired = useCallback(() => {
    setState((prev) => ({ ...prev, authExpired: null }));
  }, []);

  // –––––––––– Exec binary not found (Gap 5) ––––––––––
  const handleExecNotFound = useCallback((payload: ExecNotFoundPayload) => {
    // Dedup by binary name — show once per binary
    if (lastExecToast.current === payload.binary) return;
    lastExecToast.current = payload.binary;

    showError(
      `Credential provider "${payload.binary}" not found on PATH. ` +
        `Install it or add its directory to your system PATH, then restart.`,
    );
  }, []);

  // –––––––––– Proxy 407 (Gap 6) ––––––––––
  const handleProxyAuth = useCallback((payload: ProxyAuthPayload) => {
    const now = Date.now();
    // Throttle: at most one toast per 30 seconds
    if (now - lastProxyToast.current < 30_000) return;
    lastProxyToast.current = now;

    showWarning(
      'Corporate proxy requires NTLM/Negotiate authentication. ' +
        'Open Connection Settings → Proxy and switch auth to "ntlm-local".',
    );
  }, []);

  // –––––– Subscribe to backend events ––––––
  useEffect(() => {
    const unsubs = [
      EventsOn('connection:tls-cert-error', handleTlsCertError),
      EventsOn('connection:auth-expired', handleAuthExpired),
      EventsOn('session:auth-expired', handleAuthExpired),
      EventsOn('connection:exec-provider-not-found', handleExecNotFound),
      EventsOn('connection:proxy-auth-required', handleProxyAuth),
    ];
    return () => {
      unsubs.forEach((fn) => fn?.());
    };
  }, [handleTlsCertError, handleAuthExpired, handleExecNotFound, handleProxyAuth]);

  return {
    ...state,
    dismissTlsCertError,
    dismissAuthExpired,
  };
}
