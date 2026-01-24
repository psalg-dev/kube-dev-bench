function ensureRowId(row) {
  if (row?.id) return row;
  return { ...row, id: `port_${Date.now()}_${Math.random().toString(16).slice(2)}` };
}

export default function PortMappingEditor({ ports, onChange }) {
  const safePorts = (ports || []).map(ensureRowId);

  const updateRow = (idx, patch) => {
    const next = [...safePorts];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        id="add-port-mapping-btn"
        type="button"
        onClick={() => onChange([...(safePorts || []), { id: `port_${Date.now()}_${Math.random().toString(16).slice(2)}`, protocol: 'tcp', targetPort: '', publishedPort: '', publishMode: 'ingress' }])}
        style={{ alignSelf: 'flex-start', padding: '6px 10px', background: 'transparent', color: '#fff', border: '1px solid #30363d', borderRadius: 0, cursor: 'pointer', fontSize: 12 }}
      >
        Add port
      </button>

      {safePorts.map((p, idx) => (
        <div key={p.id || idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 140px auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Protocol</div>
            <select
              value={p.protocol || 'tcp'}
              onChange={(e) => updateRow(idx, { protocol: e.target.value })}
              aria-label="Port protocol"
              style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
            >
              <option value="tcp">tcp</option>
              <option value="udp">udp</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Target port</div>
            <input
              value={p.targetPort ?? ''}
              onChange={(e) => updateRow(idx, { targetPort: e.target.value })}
              aria-label="Target port"
              placeholder="80"
              style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Published port</div>
            <input
              value={p.publishedPort ?? ''}
              onChange={(e) => updateRow(idx, { publishedPort: e.target.value })}
              aria-label="Published port"
              placeholder="8080"
              style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Publish mode</div>
            <select
              value={p.publishMode || 'ingress'}
              onChange={(e) => updateRow(idx, { publishMode: e.target.value })}
              aria-label="Publish mode"
              style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
            >
              <option value="ingress">ingress</option>
              <option value="host">host</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => onChange(safePorts.filter((_, i) => i !== idx))}
            style={{ padding: '8px 10px', background: 'transparent', color: '#fff', border: '1px solid #30363d', borderRadius: 0, cursor: 'pointer', height: 38 }}
            aria-label="Remove port mapping"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
