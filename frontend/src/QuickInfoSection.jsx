import React from 'react';
import { formatDateDMY, formatTimestampDMYHMS } from './utils/dateUtils.js';

/**
 * Reusable Quick Info Section component for resource summary tabs
 * Provides a structured layout similar to the Pod summary view
 */
function QuickInfoSection({
  resourceName,
  data,
  loading,
  error,
  onRefresh,
  fields = []
}) {
  const renderLabels = (labels) => {
    if (!labels || Object.keys(labels).length === 0) return '-';
    const pairs = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pairs.map((p, i) => (
          <span key={i} style={{
            background: 'rgba(56,139,253,0.12)',
            border: '1px solid #30363d',
            padding: '2px 6px',
            borderRadius: 0,
            color: '#c9d1d9'
          }}>
            {p}
          </span>
        ))}
      </div>
    );
  };

  const formatDuration = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const ms = Date.now() - d.getTime();
    if (ms < 0) return 'just now';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const days = Math.floor(h / 24);
    if (days > 0) return `${days}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const statusColors = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('run') || s.includes('active') || s.includes('ready') || s.includes('available')) {
      return { bg: 'rgba(46,160,67,0.15)', fg: '#3fb950', bd: '#30363d' }; // green
    }
    if (s.includes('pend') || s.includes('init') || s.includes('wait') || s.includes('progressing')) {
      return { bg: 'rgba(187,128,9,0.12)', fg: '#d29922', bd: '#30363d' }; // yellow
    }
    if (s.includes('fail') || s.includes('err') || s.includes('crash') || s.includes('invalid')) {
      return { bg: 'rgba(248,81,73,0.12)', fg: '#f85149', bd: '#30363d' }; // red
    }
    if (s.includes('succ') || s.includes('complete')) {
      return { bg: 'rgba(56,139,253,0.12)', fg: '#58a6ff', bd: '#30363d' }; // blue
    }
    return { bg: 'rgba(110,118,129,0.12)', fg: '#8b949e', bd: '#30363d' }; // grey
  };

  const renderFieldValue = (field, value) => {
    // Handle special field types
    if (field.type === 'status' && value) {
      const c = statusColors(value);
      return (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          border: `1px solid ${c.bd}`,
          background: c.bg,
          color: c.fg
        }}>
          {value}
        </span>
      );
    }

    if (field.type === 'age' && value) {
      return formatDuration(value);
    }

    // UI convention:
    // - 'date' is a timestamp: dd.mm.yyyy HH:mm:ss
    // - 'date-only' is a pure date: dd.mm.yyyy
    if (field.type === 'date' && value) {
      return formatTimestampDMYHMS(value);
    }

    if (field.type === 'date-only' && value) {
      return formatDateDMY(value);
    }

    if (field.type === 'labels' && value) {
      return renderLabels(value);
    }

    if (field.type === 'list' && Array.isArray(value)) {
      if (value.length === 0) return '-';
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((item, i) => (
            <span key={i} style={{
              background: 'rgba(46,160,67,0.15)',
              border: '1px solid #30363d',
              padding: '2px 6px',
              borderRadius: 0,
              color: '#3fb950'
            }}>
              {item}
            </span>
          ))}
        </div>
      );
    }

    if (field.type === 'break-word' && value) {
      return <div style={{ wordBreak: 'break-all' }}>{value}</div>;
    }

    return value || '-';
  };

  return (
    <div style={{
      width: 320,
      borderRight: '1px solid #30363d', // Use hard-coded color instead of CSS variable
      background: '#0d1117', // Use hard-coded color instead of CSS variable
      display: 'flex',
      flexDirection: 'column',
      minWidth: 260,
      textAlign: 'left'
    }}>
      <div style={{
        height: 44,
        padding: '0 12px',
        borderBottom: '1px solid #30363d', // Use hard-coded color
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontWeight: 600,
        textAlign: 'left',
        background: '#161b22', // Add explicit background
        color: '#c9d1d9' // Add explicit text color
      }}>
        Quick info
      </div>

      <div style={{
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        flex: 1,
        overflow: 'auto',
        textAlign: 'left',
        color: '#c9d1d9' // Add explicit text color
      }}>
        {loading && (
          <div style={{ color: '#8b949e' }}>Loading…</div>
        )}

        {error && (
          <div style={{ color: '#f85149' }}>Error: {error}</div>
        )}

        {!loading && !error && data && Object.keys(data).length > 0 ? (
          <>
            {fields.map((field, index) => {
              const value = field.getValue ? field.getValue(data) : data[field.key];

              if (field.layout === 'flex') {
                // Special layout for fields that should be side by side
                return (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start'
                  }}>
                    <div>
                      <div style={{
                        fontSize: 12,
                        color: '#8b949e',
                        marginBottom: 4
                      }}>
                        {field.label}
                      </div>
                      <div style={{ color: '#c9d1d9' }}>{renderFieldValue(field, value)}</div>
                    </div>
                    {field.rightField && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 12,
                          color: '#8b949e',
                          marginBottom: 4
                        }}>
                          {field.rightField.label}
                        </div>
                        <div style={{ whiteSpace: 'nowrap', color: '#c9d1d9' }}>
                          {renderFieldValue(field.rightField, field.rightField.getValue ? field.rightField.getValue(data) : data[field.rightField.key])}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={index}>
                  <div style={{
                    fontSize: 12,
                    color: '#8b949e',
                    marginBottom: 4
                  }}>
                    {field.label}
                  </div>
                  <div style={{ color: '#c9d1d9' }}>{renderFieldValue(field, value)}</div>
                </div>
              );
            })}

            {onRefresh && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(56,139,253,0.15)',
                    color: '#58a6ff',
                    border: '1px solid #30363d',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#8b949e' }}>
            No data available.
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickInfoSection;
