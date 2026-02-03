import { useMemo, useState } from 'react';
import { CheckServiceImageUpdates, UpdateSwarmServiceImage } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';
import { BaseModal, ModalButton } from '../../../components/BaseModal';

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
      await UpdateSwarmServiceImage(serviceId, image);
      showSuccess(`Triggered update for ${serviceName || 'service'}`);
      onClose?.();
    } catch (err) {
      showError(`Failed to trigger update: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title="Image Updates"
      width={640}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
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
        <ModalButton onClick={onClose} disabled={busy}>Close</ModalButton>
        <ModalButton onClick={runCheck} disabled={!serviceId || busy}>Check now</ModalButton>
        <ModalButton
          variant={updateAvailable ? 'default' : 'primary'}
          style={updateAvailable ? { backgroundColor: '#d29922', borderColor: '#d29922', color: '#fff' } : undefined}
          onClick={updateNow}
          disabled={!serviceId || !image || busy}
          title="Triggers a rolling update using the current image reference"
        >
          Update now
        </ModalButton>
      </div>
    </BaseModal>
  );
}
