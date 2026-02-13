/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/purity */
import type { ReactNode } from 'react';
import StatusBadge from './components/StatusBadge';
import './QuickInfoSection.css';
import { formatDateDMY, formatTimestampDMYHMS } from './utils/dateUtils';
export type QuickInfoField = {
  key?: string;
  label?: string;
  type?: 'status' | 'age' | 'date' | 'date-only' | 'labels' | 'list' | 'break-word';
  layout?: 'flex';
  getValue?: (_data: Record<string, any>) => any;
  render?: (_value: any, _data: Record<string, any>) => ReactNode;
  rightField?: QuickInfoField;
};

export type QuickInfoSectionProps = {
  resourceName?: string;
  _resourceName?: string;
  data?: Record<string, any>;
  loading?: boolean;
  error?: any;
  onRefresh?: () => void;
  fields?: QuickInfoField[];
};

/**
 * Reusable Quick Info Section component for resource summary tabs
 * Provides a structured layout similar to the Pod summary view
 */
function QuickInfoSection({
  resourceName,
  _resourceName,
  data,
  loading,
  error,
  onRefresh,
  fields = [],
}: QuickInfoSectionProps) {
  const displayName = resourceName ?? _resourceName ?? '';
  const renderLabels = (labels: Record<string, string>) => {
    if (!labels || Object.keys(labels).length === 0) return '-';
    const pairs = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`);
    return (
      <div className="quick-info__labels">
        {pairs.map((p, i) => (
          <span key={i} className="quick-info__label-chip">
            {p}
          </span>
        ))}
      </div>
    );
  };

  const formatDuration = (date?: string) => {
    if (!date) return '-';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '-';
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

  const renderFieldValue = (field: QuickInfoField, value: any) => {
    if (field.render) {
      return field.render(value, data ?? {});
    }
    // Handle special field types
    if (field.type === 'status' && value) {
      return (
        <StatusBadge status={value} size="small" showDot={false} />
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
        <div className="quick-info__list">
          {value.map((item, i) => (
            <span key={i} className="quick-info__list-chip">
              {item}
            </span>
          ))}
        </div>
      );
    }

    if (field.type === 'break-word' && value) {
      return <div className="quick-info__break-word">{value}</div>;
    }

    return value || '-';
  };

  return (
    <div className="quick-info">
      <div className="quick-info__header" title={displayName}>
        Quick info
      </div>

      <div className="quick-info__content">
        {loading && (
          <div className="quick-info__loading">Loading…</div>
        )}

        {error && (
          <div className="quick-info__error">Error: {String(error)}</div>
        )}

        {!loading && !error && data && Object.keys(data).length > 0 ? (
          <>
            {fields.map((field, index) => {
              const value = field.getValue ? field.getValue(data) : (field.key ? data[field.key] : undefined);

              if (field.layout === 'flex') {
                // Special layout for fields that should be side by side
                return (
                  <div key={index} className="quick-info__field-row">
                    <div>
                      <div className="quick-info__field-label">
                        {field.label}
                      </div>
                      <div className="quick-info__field-value">{renderFieldValue(field, value)}</div>
                    </div>
                    {field.rightField && (
                      <div className="quick-info__field-right">
                        <div className="quick-info__field-label">
                          {field.rightField.label}
                        </div>
                        <div className="quick-info__field-right-value">
                          {renderFieldValue(field.rightField, field.rightField.getValue ? field.rightField.getValue(data) : (field.rightField.key ? data[field.rightField.key] : undefined))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={index}>
                  <div className="quick-info__field-label">
                    {field.label}
                  </div>
                  <div className="quick-info__field-value">{renderFieldValue(field, value)}</div>
                </div>
              );
            })}

            {onRefresh && (
              <div className="quick-info__refresh">
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="quick-info__refresh-button"
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="quick-info__empty">
            No data available.
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickInfoSection;
