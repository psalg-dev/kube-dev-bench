import { useMemo, useState } from 'react';
import { CheckServiceImageUpdates } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';

function stylesFor(state) {
  switch (state) {
    case 'up-to-date':
      return {
        fg: 'var(--gh-success-fg, #2ea44f)',
        bg: 'rgba(46, 164, 79, 0.10)',
        bd: 'var(--gh-border, #30363d)',
        icon: '✓',
        label: 'OK',
      };
    case 'update':
      return {
        fg: 'var(--gh-attention-fg, #d29922)',
        bg: 'rgba(210, 153, 34, 0.12)',
        bd: 'var(--gh-border, #30363d)',
        icon: '!',
        label: 'UPDATE',
      };
    default:
      return {
        fg: 'var(--gh-text-secondary, #8b949e)',
        bg: 'rgba(110, 118, 129, 0.12)',
        bd: 'var(--gh-border, #30363d)',
        icon: '—',
        label: '-',
      };
  }
}

function shortDigest(d) {
  const s = String(d || '').trim();
  if (!s) return '';
  if (s.startsWith('sha256:') && s.length > 20) return `${s.slice(0, 14)}…${s.slice(-6)}`;
  return s.length > 24 ? `${s.slice(0, 18)}…` : s;
}

export default function ImageUpdateBadge({ value, onOpenDetails }) {
  const serviceId = value?.serviceId || '';
  const localDigest = String(value?.imageLocalDigest || '').trim();
  const remoteDigest = String(value?.imageRemoteDigest || '').trim();
  const checkedAt = String(value?.imageCheckedAt || '').trim();
  const updateAvailable = Boolean(value?.imageUpdateAvailable);

  const [checking, setChecking] = useState(false);

  const state = useMemo(() => {
    if (!remoteDigest) return 'unknown';
    if (!localDigest) return 'unknown';
    return updateAvailable ? 'update' : 'up-to-date';
  }, [localDigest, remoteDigest, updateAvailable]);

  const c = stylesFor(state);

  const title = useMemo(() => {
    const parts = [];
    if (state === 'update') parts.push('Update available');
    if (state === 'up-to-date') parts.push('Up to date');
    if (state === 'unknown') parts.push('Not checked / unable to compare');

    if (checkedAt) parts.push(`Checked: ${checkedAt}`);
    if (localDigest) parts.push(`Local: ${shortDigest(localDigest)}`);
    if (remoteDigest) parts.push(`Remote: ${shortDigest(remoteDigest)}`);
    return parts.join('\n');
  }, [state, checkedAt, localDigest, remoteDigest]);

  const handleClick = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!serviceId) return;

    // Default: open details. Shift-click keeps the old quick-check behavior.
    if (!e?.shiftKey && typeof onOpenDetails === 'function') {
      onOpenDetails(serviceId);
      return;
    }

    setChecking(true);
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
      setChecking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!serviceId || checking}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        border: `1px solid ${c.bd}`,
        background: c.bg,
        color: c.fg,
        fontWeight: 600,
        fontSize: 11,
        textTransform: 'uppercase',
        borderRadius: 0,
        whiteSpace: 'nowrap',
        cursor: !serviceId || checking ? 'not-allowed' : 'pointer',
        opacity: checking ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1 }}>{checking ? '…' : c.icon}</span>
      {c.label}
    </button>
  );
}
