import { useMemo, useState } from 'react';
import { EventsEmit } from '../../../../wailsjs/runtime/runtime.js';
import { CloneSwarmSecret } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';
import { BaseModal, ModalButton, ModalPrimaryButton } from '../../../components/BaseModal';

export default function SecretCloneModal({ open, sourceId, sourceName, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [masked, setMasked] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = useMemo(() => {
    return String(name || '').trim().length > 0 && String(value || '').trim().length > 0;
  }, [name, value]);

  const handleClose = () => {
    if (saving) return;
    setError('');
    onClose?.();
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const newName = String(name || '').trim();
      const content = String(value || '');
      await CloneSwarmSecret(sourceId, newName, content);
      showSuccess(`Secret cloned: created "${newName}"`);
      try { EventsEmit('swarm:secrets:update', null); } catch {}
      onCreated?.(newName);
      onClose?.();
      setName('');
      setValue('');
      setMasked(true);
    } catch (e) {
      const msg = e?.message || String(e);
      showError(`Failed to clone secret: ${msg}`);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BaseModal
      isOpen={open}
      onClose={handleClose}
      title={`Clone Swarm secret: ${sourceName}`}
      width={720}
    >
      <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, lineHeight: 1.4 }}>
        Secret values cannot be read back from Swarm. Enter the value you want for the cloned secret.
      </div>

      {error ? <div style={{ color: '#f85149', fontSize: 12 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-secondary)', fontSize: 12 }}>
            New secret name
          </label>
          <input
            id="swarm-secret-clone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="secret-name@..."
            disabled={saving}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--gh-input-bg, #0d1117)',
              border: '1px solid var(--gh-border, #30363d)',
              borderRadius: 6,
              color: 'var(--gh-text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--gh-text, #c9d1d9)', fontSize: 12, fontWeight: 600 }}>
            Value
          </div>
          <ModalButton id="swarm-secret-clone-toggle-mask" onClick={() => setMasked(m => !m)} disabled={saving}>
            {masked ? 'Show' : 'Hide'}
          </ModalButton>
        </div>

        <textarea
          id="swarm-secret-clone-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          disabled={saving}
          placeholder="Enter secret value…"
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
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ModalButton id="swarm-secret-clone-cancel-btn" onClick={handleClose} disabled={saving}>
          Cancel
        </ModalButton>
        <ModalPrimaryButton
          id="swarm-secret-clone-create-btn"
          onClick={handleCreate}
          disabled={saving || !canSave}
        >
          {saving ? 'Creating…' : 'Create'}
        </ModalPrimaryButton>
      </div>
    </BaseModal>
  );
}
