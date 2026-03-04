/**
 * TLSCertErrorDialog — Shown when the backend detects a TLS certificate verification
 * failure. Offers the user three choices: add a custom CA, connect insecurely, or cancel.
 */
import { useCallback, useState } from 'react';
import { ConnectInsecure } from '../../../wailsjs/go/main/App';
import { showError, showWarning } from '../../notification';
import type { TLSCertErrorPayload } from '../../hooks/useEnterpriseAuthEvents';
import './TLSCertErrorDialog.css';

interface TLSCertErrorDialogProps {
  payload: TLSCertErrorPayload;
  onDismiss: () => void;
  /** Called when the user chooses "Connect Anyway" and the backend confirms. */
  onInsecureConnected?: () => void;
  /** Called when the user wants to add a CA certificate. */
  onAddCA?: () => void;
}

export function TLSCertErrorDialog({
  payload,
  onDismiss,
  onInsecureConnected,
  onAddCA,
}: TLSCertErrorDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleInsecure = useCallback(async () => {
    setLoading(true);
    try {
      await ConnectInsecure(payload.context);
      showWarning('Connected with TLS verification disabled. This is NOT recommended for production.');
      onInsecureConnected?.();
      onDismiss();
    } catch (err: unknown) {
      showError(`Failed to connect insecurely: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [payload.context, onDismiss, onInsecureConnected]);

  const handleAddCA = useCallback(() => {
    onAddCA?.();
    onDismiss();
  }, [onAddCA, onDismiss]);

  return (
    <div className="tls-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="tls-dialog-title">
      <div className="tls-dialog">
        <h2 id="tls-dialog-title" className="tls-dialog-title">
          TLS Certificate Error
        </h2>

        <p className="tls-dialog-message">
          Could not verify the TLS certificate for <strong>{payload.host}</strong>
          {payload.context && (
            <>
              {' '}(context: <code>{payload.context}</code>)
            </>
          )}.
        </p>

        <details className="tls-dialog-details">
          <summary>Technical details</summary>
          <pre>{payload.error}</pre>
        </details>

        <div className="tls-dialog-actions">
          <button
            className="tls-btn tls-btn-primary"
            onClick={handleAddCA}
            disabled={loading}
          >
            Add CA Certificate
          </button>

          <button
            className="tls-btn tls-btn-danger"
            onClick={handleInsecure}
            disabled={loading}
          >
            {loading ? 'Connecting…' : 'Connect Anyway (Insecure)'}
          </button>

          <button
            className="tls-btn tls-btn-secondary"
            onClick={onDismiss}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
