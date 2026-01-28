import { useEffect, useMemo, useState } from 'react';
import { EventsEmit } from '../../../../wailsjs/runtime/runtime.js';
import { GetSwarmConfigData, UpdateSwarmConfigData } from '../../swarmApi.js';
import TextEditorTab from '../../../layout/bottompanel/TextEditorTab.jsx';
import { showError, showSuccess } from '../../../notification.js';

export default function ConfigEditModal({ open, configId, configName, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [original, setOriginal] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const data = await GetSwarmConfigData(configId);
        if (!active) return;
        const text = data ?? '';
        setOriginal(text);
        setValue(text);
      } catch (e) {
        if (!active) return;
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, configId]);

  const isDirty = useMemo(() => value !== original, [value, original]);
  const isEmpty = useMemo(() => !String(value || '').trim(), [value]);

  const handleSave = async () => {
    if (!isDirty) return;
    if (isEmpty) {
      setError('Config data cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await UpdateSwarmConfigData(configId, value);
      const newName = result?.newConfigName || 'new config';
      const updatedCount = Array.isArray(result?.updated) ? result.updated.length : 0;

      showSuccess(`Config updated: created "${newName}" (updated ${updatedCount} service${updatedCount === 1 ? '' : 's'})`);

      try { EventsEmit('swarm:configs:update', null); } catch {}
      try { EventsEmit('swarm:services:update', null); } catch {}

      onSaved?.(result);
      onClose?.();
    } catch (e) {
      const msg = e?.message || String(e);
      showError(`Failed to update config: ${msg}`);
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
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} data-testid="swarm-config-edit-modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)' }}>
            Edit Swarm config: {configName}
          </div>
          <button style={buttonStyle} onClick={() => onClose?.()} disabled={saving}>
            Close
          </button>
        </div>

        <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, lineHeight: 1.4 }}>
          Docker Swarm configs are immutable. Saving will create a new config with a timestamp suffix,
          update any services that reference this config, and delete the old config. Services may restart.
        </div>

        {error ? (
          <div style={{ color: '#f85149', fontSize: 12 }}>
            {error}
          </div>
        ) : null}

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--gh-text, #c9d1d9)', fontSize: 12, fontWeight: 600 }}>
              Data
            </div>
            <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
              {isDirty ? 'Modified' : 'Unchanged'}
            </div>
          </div>

          <textarea
            data-testid="swarm-config-edit-textarea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, opacity: 0 }}
          />

          <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--gh-border, #30363d)', borderRadius: 6, overflow: 'hidden' }}>
            <TextEditorTab
              content={value}
              filename={configName}
              onChange={setValue}
              disabled={saving}
              loading={loading}
              error={null}
              loadingLabel="Loading…"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={buttonStyle} onClick={() => onClose?.()} disabled={saving}>
            Cancel
          </button>
          <button
            id="swarm-config-edit-save-btn"
            style={{ ...buttonStyle, backgroundColor: '#238636', color: '#fff', borderColor: '#238636' }}
            onClick={handleSave}
            disabled={saving || loading || !isDirty || isEmpty}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
