import React from 'react';

export default function KeyValueEditor({
  title,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addButtonLabel,
  ariaPrefix,
  addButtonId,
}) {
  const safeRows = rows || [];

  return (
    <div style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: '#858585' }}>{title}</div>
        <button
          id={addButtonId}
          type="button"
          onClick={() => onChange([...(safeRows || []), { id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' }])}
          style={{ padding: '6px 10px', background: 'transparent', color: '#fff', border: '1px solid #3c3c3c', borderRadius: 0, cursor: 'pointer', fontSize: 12 }}
          aria-label={addButtonLabel}
        >
          {addButtonLabel}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 8, alignItems: 'center', maxWidth: '100%' }}>
        {safeRows.map((row, idx) => (
          <React.Fragment key={row.id || idx}>
            <input
              value={row.key}
              onChange={(e) => {
                const next = [...safeRows];
                next[idx] = { ...next[idx], key: e.target.value };
                onChange(next);
              }}
              placeholder={keyPlaceholder}
              aria-label={`${ariaPrefix} key`}
              style={{ width: '100%', padding: '8px 10px', background: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', boxSizing: 'border-box' }}
            />
            <input
              value={row.value}
              onChange={(e) => {
                const next = [...safeRows];
                next[idx] = { ...next[idx], value: e.target.value };
                onChange(next);
              }}
              placeholder={valuePlaceholder}
              aria-label={`${ariaPrefix} value`}
              style={{ width: '100%', padding: '8px 10px', background: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => {
                const next = safeRows.filter((_, i) => i !== idx);
                onChange(next.length ? next : [{ id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' }]);
              }}
              style={{ padding: '8px 10px', background: 'transparent', color: '#fff', border: '1px solid #3c3c3c', borderRadius: 0, cursor: 'pointer' }}
              aria-label={`Remove ${ariaPrefix.toLowerCase()} row`}
              title="Remove"
            >
              ×
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
