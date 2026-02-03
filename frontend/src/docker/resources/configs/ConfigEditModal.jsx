import { useEffect, useMemo, useState } from 'react';
import { EventsEmit } from '../../../../wailsjs/runtime/runtime.js';
import { GetSwarmConfigData, UpdateSwarmConfigData } from '../../swarmApi.js';
import TextEditorTab from '../../../layout/bottompanel/TextEditorTab.jsx';
import { showError, showSuccess } from '../../../notification.js';
import { BaseModal, ModalButton, ModalPrimaryButton } from '../../../components/BaseModal';

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

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={`Edit Swarm config: ${configName}`}
      width={720}
      testId="swarm-config-edit-modal"
    >
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
        <ModalButton onClick={() => onClose?.()} disabled={saving}>
          Cancel
        </ModalButton>
        <ModalPrimaryButton
          id="swarm-config-edit-save-btn"
          onClick={handleSave}
          disabled={saving || loading || !isDirty || isEmpty}
        >
          {saving ? 'Saving…' : 'Save'}
        </ModalPrimaryButton>
      </div>
    </BaseModal>
  );
}
