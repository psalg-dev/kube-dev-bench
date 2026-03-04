/**
 * AuthExpiredBanner — A sticky banner shown when the backend detects auth
 * expiry (401 Unauthorized). Offers a reconnect action.
 */
import { useCallback, useState } from 'react';
import { RefreshCredentials } from '../../../wailsjs/go/main/App';
import { showError, showSuccess } from '../../notification';
import type { AuthExpiredPayload } from '../../hooks/useEnterpriseAuthEvents';
import './AuthExpiredBanner.css';

interface AuthExpiredBannerProps {
  payload: AuthExpiredPayload;
  onDismiss: () => void;
  /** Called after a successful credential refresh to trigger a reconnect flow. */
  onReconnect?: () => void;
}

export function AuthExpiredBanner({ payload, onDismiss, onReconnect }: AuthExpiredBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleReconnect = useCallback(async () => {
    setLoading(true);
    try {
      await RefreshCredentials(payload.context);
      showSuccess('Credentials refreshed successfully.');
      onReconnect?.();
      onDismiss();
    } catch (err: unknown) {
      showError(`Credential refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [payload.context, onDismiss, onReconnect]);

  return (
    <div className="auth-expired-banner" role="alert">
      <span className="auth-expired-icon">🔑</span>
      <span className="auth-expired-text">
        Authentication expired for <strong>{payload.context}</strong>.
        Your session credentials need to be refreshed.
      </span>
      <div className="auth-expired-actions">
        <button
          className="auth-expired-btn auth-expired-reconnect"
          onClick={handleReconnect}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Reconnect'}
        </button>
        <button
          className="auth-expired-btn auth-expired-dismiss"
          onClick={onDismiss}
          disabled={loading}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
