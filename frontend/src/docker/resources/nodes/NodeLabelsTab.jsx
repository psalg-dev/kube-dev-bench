import React, { useMemo, useState } from 'react';
import KeyValueEditor from '../../../components/forms/KeyValueEditor.jsx';
import { UpdateSwarmNodeLabels } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';

function objectToRows(obj) {
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

function rowsToObject(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = (row?.key || '').trim();
    if (!key) continue;
    out[key] = (row?.value ?? '').toString();
  }
  return out;
}

function stableStringifyLabels(labelsObj) {
  return JSON.stringify(
    Object.keys(labelsObj || {})
      .sort()
      .reduce((acc, k) => {
        acc[k] = labelsObj[k];
        return acc;
      }, {})
  );
}

export default function NodeLabelsTab({ nodeId, initialLabels, onSaved }) {
  const [rows, setRows] = useState(() => objectToRows(initialLabels));
  const [saving, setSaving] = useState(false);

  const initialLabelsCanonical = useMemo(() => stableStringifyLabels(initialLabels || {}), [initialLabels]);
  const currentLabelsObj = useMemo(() => rowsToObject(rows), [rows]);
  const isDirty = useMemo(
    () => stableStringifyLabels(currentLabelsObj) !== initialLabelsCanonical,
    [currentLabelsObj, initialLabelsCanonical]
  );

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

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'rgba(215, 58, 73, 0.1)',
    borderColor: '#d73a49',
    color: '#f85149',
  };

  const handleReset = () => {
    setRows(objectToRows(initialLabels));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await UpdateSwarmNodeLabels(nodeId, currentLabelsObj);
      showSuccess('Node labels updated');
      onSaved?.();
    } catch (err) {
      showError(`Failed to update node labels: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
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
