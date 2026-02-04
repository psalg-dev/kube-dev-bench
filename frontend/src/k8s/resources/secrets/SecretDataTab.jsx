import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { showError, showSuccess } from '../../../notification';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting.js';

export default function SecretDataTab({ namespace, secretName }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [copiedKey, setCopiedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [draftValue, setDraftValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!namespace || !secretName) return;
    setLoading(true);
    setError(null);
    try {
      const result = await AppAPI.GetSecretDataByName(namespace, secretName);
      setData(result || []);
    } catch (err) {
      setError(err?.message || 'Failed to fetch secret data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, secretName]);

  const toggleVisibility = (key) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyToClipboard = async (key, value) => {
    try {
      // Decode base64 before copying
      const decoded = atob(value);
      await navigator.clipboard.writeText(decoded);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const decodeValue = (base64Value) => {
    try {
      return atob(base64Value);
    } catch {
      return '[Unable to decode]';
    }
  };

  const beginEdit = (key, base64Value, isBinary) => {
    if (isBinary) return;
    setEditingKey(key);
    setDraftValue(decodeValue(base64Value));
    setVisibleKeys(prev => new Set(prev).add(key));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftValue('');
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      await AppAPI.UpdateSecretDataKey(namespace, secretName, editingKey, draftValue);
      showSuccess(`Secret '${secretName}' updated (${editingKey})`);
      cancelEdit();
      await fetchData();
    } catch (e) {
      showError(`Failed to update Secret '${secretName}': ${e?.message || e}`);
      setSaving(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns = useMemo(() => ([
    { key: 'key', label: 'Key' },
    { key: 'value', label: 'Value' },
    { key: 'size', label: 'Size' },
  ]), []);
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' }));
  const sortedData = useMemo(() => {
    return sortRows(data, sortState.key, sortState.direction, (row, key) => {
      if (key === 'size') return row?.size;
      if (key === 'value') return decodeValue(row?.value || '');
      return row?.[key];
    });
  }, [data, sortState]);

  const headerButtonStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    textAlign: 'left',
  };

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
  }

  if (!data || data.length === 0) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>This Secret has no data.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
          {data.length} key{data.length !== 1 ? 's' : ''}
        </span>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 3,
          backgroundColor: '#f8514920',
          color: '#f85149'
        }}>
          Sensitive data - click eye icon to reveal
        </span>
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th style={{ width: 200 }} aria-sort={sortState.key === 'key' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'key'))}>
                <span>Key</span>
                <span aria-hidden="true">{sortState.key === 'key' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th aria-sort={sortState.key === 'value' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'value'))}>
                <span>Value</span>
                <span aria-hidden="true">{sortState.key === 'value' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th style={{ textAlign: 'right', width: 80 }} aria-sort={sortState.key === 'size' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" style={{ ...headerButtonStyle, justifyContent: 'flex-end' }} onClick={() => setSortState((cur) => toggleSortState(cur, 'size'))}>
                <span>Size</span>
                <span aria-hidden="true">{sortState.key === 'size' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
              </button>
            </th>
            <th style={{ textAlign: 'center', width: 100 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => {
            const isVisible = visibleKeys.has(item.key);
            const decodedValue = isVisible ? decodeValue(item.value) : null;
            const isCopied = copiedKey === item.key;
            const isEditing = editingKey === item.key;
            const canEdit = !item.isBinary;

            return (
              <tr key={item.key}>
                <td style={{ fontFamily: 'monospace' }}>
                  {item.key}
                  {item.isBinary && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '1px 4px',
                      borderRadius: 2,
                      backgroundColor: '#f8514920',
                      color: '#f85149'
                    }}>
                      binary
                    </span>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <textarea
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: 120,
                        padding: 8,
                        backgroundColor: '#0d1117',
                        border: '1px solid #30363d',
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'var(--gh-text, #c9d1d9)',
                        resize: 'vertical'
                      }}
                    />
                  ) : isVisible ? (
                    <pre style={{
                      margin: 0,
                      padding: 8,
                      backgroundColor: '#0d1117',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: 'var(--gh-text, #c9d1d9)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 150,
                      overflow: 'auto'
                    }}>
                      {decodedValue}
                    </pre>
                  ) : (
                    <span style={{ color: 'var(--gh-text-muted, #8b949e)', fontFamily: 'monospace' }}>
                      {'•'.repeat(Math.min(20, item.size))}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right', fontSize: 12 }} className="text-muted">
                  {formatSize(item.size)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button
                      onClick={() => toggleVisibility(item.key)}
                      title={isVisible ? 'Hide value' : 'Show value'}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: '1px solid #30363d',
                        borderRadius: 4,
                        color: 'var(--gh-text, #c9d1d9)',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      {isVisible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => copyToClipboard(item.key, item.value)}
                          title="Copy decoded value"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: isCopied ? '#23863620' : 'transparent',
                            border: `1px solid ${isCopied ? '#238636' : '#30363d'}`,
                            borderRadius: 4,
                            color: isCopied ? '#238636' : 'var(--gh-text, #c9d1d9)',
                            cursor: 'pointer',
                            fontSize: 14
                          }}
                        >
                          {isCopied ? '✓' : '📋'}
                        </button>
                        <button
                          onClick={() => beginEdit(item.key, item.value, item.isBinary)}
                          disabled={!canEdit}
                          title={canEdit ? 'Edit key' : 'Binary keys cannot be edited'}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'transparent',
                            border: '1px solid #30363d',
                            borderRadius: 4,
                            color: 'var(--gh-text, #c9d1d9)',
                            cursor: canEdit ? 'pointer' : 'not-allowed',
                            fontSize: 12,
                            opacity: canEdit ? 1 : 0.6
                          }}
                        >
                          Edit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          title="Cancel"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'transparent',
                            border: '1px solid #30363d',
                            borderRadius: 4,
                            color: 'var(--gh-text, #c9d1d9)',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            opacity: saving ? 0.6 : 1
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          title="Save"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#238636',
                            border: '1px solid #2ea44f',
                            borderRadius: 4,
                            color: '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            opacity: saving ? 0.6 : 1
                          }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
