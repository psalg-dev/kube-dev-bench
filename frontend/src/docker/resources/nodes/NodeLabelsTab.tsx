import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import KeyValueEditor from '../../../components/forms/KeyValueEditor';
import { UpdateSwarmNodeLabels } from '../../swarmApi';
import { showError, showSuccess } from '../../../notification';

interface KeyValueRow {
  id?: string;
  key: string;
  value: string;
}

interface NodeLabelsTabProps {
  nodeId?: string;
  initialLabels?: Record<string, string> | null;
  onSaved?: () => void;
}

function objectToRows(obj?: Record<string, string> | null): KeyValueRow[] {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) {
    return [{ id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' }];
  }
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      id: `kv_${key}_${Math.random().toString(16).slice(2)}`,
      key,
      value: value ?? '',
    }));
}

function rowsToObject(rows: KeyValueRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows || []) {
    const key = (row?.key || '').trim();
    if (!key) continue;
    out[key] = (row?.value ?? '').toString();
  }
  return out;
}

function stableStringifyLabels(labelsObj: Record<string, string>) {
  return JSON.stringify(
    Object.keys(labelsObj || {})
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = labelsObj[k];
        return acc;
      }, {})
  );
}

export default function NodeLabelsTab({ nodeId, initialLabels, onSaved }: NodeLabelsTabProps) {
  const [rows, setRows] = useState<KeyValueRow[]>(() => objectToRows(initialLabels || {}));
  const [saving, setSaving] = useState(false);

  const initialLabelsCanonical = useMemo(
    () => stableStringifyLabels(initialLabels || {}),
    [initialLabels]
  );
  const currentLabelsObj = useMemo(() => rowsToObject(rows), [rows]);
  const isDirty = useMemo(
    () => stableStringifyLabels(currentLabelsObj) !== initialLabelsCanonical,
    [currentLabelsObj, initialLabelsCanonical]
  );

  const buttonStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  const dangerButtonStyle: CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'rgba(215, 58, 73, 0.1)',
    borderColor: '#d73a49',
    color: '#f85149',
  };

  const handleReset = () => {
    setRows(objectToRows(initialLabels || {}));
  };

  const handleSave = async () => {
    if (!nodeId) {
      showError('Node ID is required to update labels');
      return;
    }
    setSaving(true);
    try {
      await UpdateSwarmNodeLabels(nodeId, currentLabelsObj);
      showSuccess('Node labels updated');
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to update node labels: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
          Labels are key/value metadata stored on the Swarm node.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            id="swarm-node-labels-reset-btn"
            type="button"
            style={dangerButtonStyle}
            onClick={handleReset}
            disabled={saving || !isDirty}
          >
            Reset
          </button>
          <button
            id="swarm-node-labels-save-btn"
            type="button"
            style={{ ...buttonStyle, backgroundColor: '#238636', color: '#fff' }}
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <KeyValueEditor
        title="Node Labels"
        rows={rows}
        onChange={setRows}
        keyPlaceholder="key"
        valuePlaceholder="value"
        addButtonLabel="Add Label"
        ariaPrefix="Label"
        addButtonId="swarm-node-labels-add-btn"
      />
    </div>
  );
}
