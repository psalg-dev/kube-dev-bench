import { useMemo, useState } from 'react';
import { EventsEmit } from '../../../../wailsjs/runtime/runtime.js';
import { UpdateSwarmSecretData } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';

export default function SecretEditModal({ open, secretId, secretName, titleVerb = 'Edit', onClose, onSaved }) {
  const [ack, setAck] = useState(false);
  const [masked, setMasked] = useState(true);
  const [revealConfirmed, setRevealConfirmed] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEmpty = useMemo(() => !String(value || '').trim(), [value]);

  const handleSave = async () => {
    if (!ack) {
      setError('Please confirm you understand the impact before saving.');
      return;
    }
    if (isEmpty) {
      setError('Secret value cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await UpdateSwarmSecretData(secretId, value);
      const newName = result?.newSecretName || 'new secret';
      const updatedCount = Array.isArray(result?.updated) ? result.updated.length : 0;

      showSuccess(`Secret updated: created "${newName}" (updated ${updatedCount} service${updatedCount === 1 ? '' : 's'})`);

      try { EventsEmit('swarm:secrets:update', null); } catch {}
      try { EventsEmit('swarm:services:update', null); } catch {}

      onSaved?.(result);
      onClose?.();
    } catch (e) {
      const msg = e?.message || String(e);
      showError(`Failed to update secret: ${msg}`);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
  };

  const modalStyle = {
    backgroundColor: 'var(--gh-bg, #0d1117)',
    borderRadius: 8,
    padding: 20,
    width: 720,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    overflow: 'hidden',
    border: '1px solid var(--gh-border, #30363d)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const buttonStyle = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  return (
    <div style={overlayStyle} onClick={() => onClose?.()}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)' }}>
            {titleVerb} Swarm secret: {secretName}
          </div>
          <button style={buttonStyle} onClick={() => onClose?.()} disabled={saving}>
            Close
          </button>
        </div>

        <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, lineHeight: 1.4 }}>
          Docker Swarm secrets are immutable. Saving will create a new secret with a timestamp suffix,
          update any services that reference this secret, and delete the old secret. Services may restart.
          Existing secret values cannot be read back from Swarm; you must enter the new value.
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--gh-text, #c9d1d9)', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(Boolean(e.target.checked))}
            disabled={saving}
          />
          I understand this will redeploy affected services.
        </label>

        {error ? (
          <div style={{ color: '#f85149', fontSize: 12 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--gh-text, #c9d1d9)', fontSize: 12, fontWeight: 600 }}>
            New Value
          </div>
          <button
            style={buttonStyle}
            onClick={() => {
              if (saving) return;
              if (masked) {
                if (!revealConfirmed) {
                  const ok = window.confirm(
                    'Revealing the secret value will show it on-screen. Make sure no one is watching/recording your screen.\n\nReveal now?'
                  );
                  if (!ok) return;
                  setRevealConfirmed(true);
                }
                setMasked(false);
              } else {
                setMasked(true);
              }
            }}
            disabled={saving}
          >
            {masked ? 'Show' : 'Hide'}
          </button>
        </div>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          disabled={!ack || saving}
          placeholder={!ack ? 'Confirm above to enable editing…' : 'Enter new secret value…'}
          style={{
            width: '100%',
            minHeight: 220,
            resize: 'none',
            padding: 12,
            backgroundColor: 'var(--gh-input-bg, #0d1117)',
            border: '1px solid var(--gh-border, #30363d)',
            borderRadius: 6,
            color: 'var(--gh-text, #c9d1d9)',
            fontSize: 13,
            fontFamily: 'monospace',
            outline: 'none',
            WebkitTextSecurity: masked ? 'disc' : 'none',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={buttonStyle} onClick={() => onClose?.()} disabled={saving}>
            Cancel
          </button>
          <button
            style={{ ...buttonStyle, backgroundColor: '#238636', color: '#fff', borderColor: '#238636' }}
            onClick={handleSave}
            disabled={saving || !ack || isEmpty}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
