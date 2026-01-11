import React, { useMemo, useState } from 'react';
import { CheckServiceImageUpdates, UpdateSwarmServiceImage } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';

function shortDigest(d) {
  const s = String(d || '').trim();
  if (!s) return '-';
  if (s.startsWith('sha256:') && s.length > 20) return `${s.slice(0, 14)}…${s.slice(-6)}`;
  return s.length > 32 ? `${s.slice(0, 28)}…` : s;
}

export default function ImageUpdateModal({ open, service, onClose }) {
  const [busy, setBusy] = useState(false);

  const serviceId = service?.id || '';
  const serviceName = service?.name || '';
  const image = service?.image || '';

  const localDigest = String(service?.imageLocalDigest || '').trim();
  const remoteDigest = String(service?.imageRemoteDigest || '').trim();
  const checkedAt = String(service?.imageCheckedAt || '').trim();
  const updateAvailable = Boolean(service?.imageUpdateAvailable);

  const stateLabel = useMemo(() => {
    if (!remoteDigest || !localDigest) return 'Unknown';
    return updateAvailable ? 'Update available' : 'Up to date';
  }, [localDigest, remoteDigest, updateAvailable]);

  if (!open) return null;

  const overlay = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
  };

  const modal = {
    backgroundColor: 'var(--gh-bg, #0d1117)',
    borderRadius: 8,
    padding: 20,
    width: 640,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    border: '1px solid var(--gh-border, #30363d)',
  };

  const button = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  const runCheck = async () => {
    if (!serviceId) return;
    setBusy(true);
    try {
      const res = await CheckServiceImageUpdates([serviceId]);
      const info = res?.[serviceId];
      const err = String(info?.error || '').trim();
      if (err) {
        showError(`Image update check failed: ${err}`);
      } else {
        showSuccess('Image update check complete');
      }
    } catch (err) {
      showError(`Image update check failed: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  const updateNow = async () => {
    if (!serviceId || !image) return;
    setBusy(true);
    try {
      // This triggers a rolling update (ForceUpdate++) even if the image string stays the same.
      await UpdateSwarmServiceImage(serviceId, image);
      showSuccess(`Triggered update for ${serviceName || 'service'}`);
      onClose?.();
    } catch (err) {
      showError(`Failed to trigger update: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--gh-text)' }}>Image Updates</h3>
          <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>{stateLabel}</div>
        </div>

        <div style={{ marginTop: 10, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
          Service: <span style={{ color: 'var(--gh-text)' }}>{serviceName || serviceId}</span>
        </div>

        <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--gh-border, #30363d)', background: 'rgba(110,118,129,0.10)' }}>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 6 }}>Image</div>
          <div style={{ fontSize: 12, color: 'var(--gh-text)', wordBreak: 'break-all' }}>{image || '-'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div style={{ padding: 12, border: '1px solid var(--gh-border, #30363d)' }}>
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>Local digest</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gh-text)' }}>{shortDigest(localDigest)}</div>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--gh-border, #30363d)' }}>
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>Remote digest</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gh-text)' }}>{shortDigest(remoteDigest)}</div>
          </div>
        </div>

        <div style={{ marginTop: 10, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
          Checked: {checkedAt || '-'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button style={button} onClick={onClose} disabled={busy}>Close</button>
          <button style={button} onClick={runCheck} disabled={!serviceId || busy}>Check now</button>
          <button
            style={{ ...button, backgroundColor: updateAvailable ? '#d29922' : '#238636', color: '#fff' }}
            onClick={updateNow}
            disabled={!serviceId || !image || busy}
            title="Triggers a rolling update using the current image reference"
          >
            Update now
          </button>
        </div>
      </div>
    </div>
  );
}
