import React, { useEffect, useMemo, useState } from 'react';
import { GetSwarmStackResources } from '../../swarmApi.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';

function Empty({ text }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--gh-text-secondary, #8b949e)' }}>
      {text}
    </div>
  );
}

function Table({ columns, rows, rowKey }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th
                key={c.key}
                style={{
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: 12,
                  color: 'var(--gh-text, #c9d1d9)',
                  borderBottom: '1px solid var(--gh-border, #30363d)',
                  padding: '8px 10px',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)}>
              {columns.map(c => (
                <td
                  key={c.key}
                  style={{
                    fontSize: 12,
                    color: 'var(--gh-text, #c9d1d9)',
                    borderBottom: '1px solid var(--gh-border, #30363d)',
                    padding: '8px 10px',
                    verticalAlign: 'top',
                    wordBreak: c.breakWord ? 'break-word' : 'normal',
                    fontFamily: c.mono ? 'monospace' : 'inherit',
                  }}
                >
                  {c.render ? c.render(r) : (r?.[c.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StackResourcesTab({ stackName, resource }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await GetSwarmStackResources(stackName);
        if (!active) return;
        setData(res || null);
      } catch (e) {
        if (!active) return;
        setError(String(e));
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [stackName]);

  const rows = useMemo(() => {
    if (!data) return [];
    switch (resource) {
      case 'networks': return data.networks || [];
      case 'volumes': return data.volumes || [];
      case 'configs': return data.configs || [];
      case 'secrets': return data.secrets || [];
      default: return [];
    }
  }, [data, resource]);

  const columns = useMemo(() => {
    switch (resource) {
      case 'networks':
        return [
          { key: 'name', label: 'Name' },
          { key: 'driver', label: 'Driver' },
          { key: 'scope', label: 'Scope' },
          { key: 'attachable', label: 'Attachable', render: (r) => r.attachable ? 'Yes' : 'No' },
          { key: 'internal', label: 'Internal', render: (r) => r.internal ? 'Yes' : 'No' },
          { key: 'id', label: 'ID', mono: true, breakWord: true },
        ];
      case 'volumes':
        return [
          { key: 'name', label: 'Name' },
          { key: 'driver', label: 'Driver' },
          { key: 'scope', label: 'Scope' },
          { key: 'createdAt', label: 'Created', render: (r) => r.createdAt ? formatTimestampDMYHMS(r.createdAt) : '-' },
        ];
      case 'configs':
        return [
          { key: 'name', label: 'Name' },
          { key: 'dataSize', label: 'Size', render: (r) => {
            const size = r.dataSize;
            if (size === undefined || size === null) return '-';
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            return `${(size / 1024 / 1024).toFixed(1)} MB`;
          }},
          { key: 'createdAt', label: 'Created', render: (r) => r.createdAt ? formatTimestampDMYHMS(r.createdAt) : '-' },
          { key: 'id', label: 'ID', mono: true, breakWord: true },
        ];
      case 'secrets':
        return [
          { key: 'name', label: 'Name' },
          { key: 'createdAt', label: 'Created', render: (r) => r.createdAt ? formatTimestampDMYHMS(r.createdAt) : '-' },
          { key: 'id', label: 'ID', mono: true, breakWord: true },
        ];
      default:
        return [];
    }
  }, [resource]);

  if (loading) {
    return <Empty text={`Loading ${resource}...`} />;
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#f85149' }}>
        Failed to load {resource}: {error}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <Empty text={`No ${resource} found for this stack.`} />;
  }

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id || r.name}
    />
  );
}
