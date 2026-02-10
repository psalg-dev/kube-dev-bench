import { Fragment } from 'react';

type KeyValueRow = {
  id?: string;
  key: string;
  value: string;
};

type KeyValueEditorProps = {
  title?: string;
  rows?: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonLabel: string;
  ariaPrefix: string;
  addButtonId?: string;
};

export default function KeyValueEditor({
  title,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addButtonLabel,
  ariaPrefix,
  addButtonId,
}: KeyValueEditorProps) {
  const safeRows = rows || [];
  const normalizedAriaPrefix = ariaPrefix || 'Row';

  return (
    <div style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 12, color: '#858585' }}>{title}</div>
        <button
          id={addButtonId}
          type="button"
          onClick={() =>
            onChange([
              ...(safeRows || []),
              { id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' },
            ])
          }
          style={{
            padding: '6px 10px',
            background: 'transparent',
            color: '#fff',
            border: '1px solid #3c3c3c',
            borderRadius: 0,
            cursor: 'pointer',
            fontSize: 12,
          }}
          aria-label={addButtonLabel}
        >
          {addButtonLabel}
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
          gap: 8,
          alignItems: 'center',
          maxWidth: '100%',
        }}
      >
        {safeRows.map((row, idx) => (
          <Fragment key={row.id || idx}>
            <input
              value={row.key}
              onChange={(event) => {
                const next = [...safeRows];
                next[idx] = { ...next[idx], key: event.target.value };
                onChange(next);
              }}
              placeholder={keyPlaceholder}
              aria-label={`${normalizedAriaPrefix} key`}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#181818',
                border: '1px solid #3c3c3c',
                color: '#fff',
                boxSizing: 'border-box',
              }}
            />
            <input
              value={row.value}
              onChange={(event) => {
                const next = [...safeRows];
                next[idx] = { ...next[idx], value: event.target.value };
                onChange(next);
              }}
              placeholder={valuePlaceholder}
              aria-label={`${normalizedAriaPrefix} value`}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#181818',
                border: '1px solid #3c3c3c',
                color: '#fff',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => {
                const next = safeRows.filter((_, i) => i !== idx);
                onChange(
                  next.length
                    ? next
                    : [{ id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' }]
                );
              }}
              style={{
                padding: '8px 10px',
                background: 'transparent',
                color: '#fff',
                border: '1px solid #3c3c3c',
                borderRadius: 0,
                cursor: 'pointer',
              }}
              aria-label={`Remove ${normalizedAriaPrefix.toLowerCase()} row`}
              title="Remove"
            >
              ×
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
