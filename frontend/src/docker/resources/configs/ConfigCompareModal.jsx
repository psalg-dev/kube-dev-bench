import { useEffect, useMemo, useState } from 'react';
import * as Diff from 'diff';
import TextViewerTab from '../../../layout/bottompanel/TextViewerTab.jsx';
import { GetSwarmConfigData } from '../../swarmApi.js';
import { BaseModal, ModalButton } from '../../../components/BaseModal';

function buildUnifiedDiffText(aText, bText) {
  const parts = Diff.diffLines(aText || '', bText || '');
  let out = '';
  for (const part of parts) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const lines = String(part.value || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Keep trailing newline behavior stable.
      if (i === lines.length - 1 && line === '') break;
      out += `${prefix}${line}\n`;
    }
  }
  return out;
}

export default function ConfigCompareModal({
  open,
  baseConfigId,
  baseConfigName,
  configs,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [baseText, setBaseText] = useState('');
  const [otherId, setOtherId] = useState('');
  const [otherText, setOtherText] = useState('');

  const otherOptions = useMemo(() => {
    const list = Array.isArray(configs) ? configs : [];
    return list.filter((c) => c?.id && c.id !== baseConfigId);
  }, [configs, baseConfigId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    setBaseText('');
    setOtherText('');

    (async () => {
      try {
        const text = await GetSwarmConfigData(baseConfigId);
        if (!active) return;
        setBaseText(text || '');
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
  }, [open, baseConfigId]);

  useEffect(() => {
    if (!open) return;
    if (!otherId) {
      setOtherText('');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const text = await GetSwarmConfigData(otherId);
        if (!active) return;
        setOtherText(text || '');
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
  }, [open, otherId]);

  const diffText = useMemo(() => {
    if (!open) return '';
    if (!otherId) return '';
    return buildUnifiedDiffText(baseText || '', otherText || '');
  }, [open, otherId, baseText, otherText]);

  const otherName = otherOptions.find((c) => c.id === otherId)?.name || '';

  const selectStyle = {
    backgroundColor: 'var(--gh-input-bg, #0d1117)',
    color: 'var(--gh-text, #c9d1d9)',
    border: '1px solid var(--gh-border, #30363d)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    outline: 'none',
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={`Compare configs: ${baseConfigName}`}
      width={920}
      maxHeight="calc(100vh - 48px)"
      footer={<ModalButton onClick={() => onClose?.()}>Close</ModalButton>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 600 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
            Compare against:
          </div>
          <select
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
            style={selectStyle}
          >
            <option value="">(select a config)</option>
            {otherOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {otherName ? (
            <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
              showing unified diff (+ added, - removed)
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--gh-border, #30363d)', borderRadius: 6, overflow: 'hidden' }}>
          <TextViewerTab
            content={otherId ? diffText : 'Select a config to compare.'}
            loading={loading}
            error={error || null}
            loadingLabel="Loading config data..."
            filename={`${baseConfigName}__diff.txt`}
          />
        </div>
      </div>
    </BaseModal>
  );
}
