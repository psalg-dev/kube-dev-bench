import { useMemo } from 'react';
import LabelsInline from '../../LabelsInline';

type SummaryTabHeaderProps = {
  name?: string;
  labels?: Record<string, unknown> | null;
  hideTitle?: boolean;
  actions?: React.ReactNode;
};

export default function SummaryTabHeader({
  name,
  labels,
  hideTitle = false,
  actions = null,
}: SummaryTabHeaderProps) {
  const normalized = useMemo(() => {
    if (!labels || typeof labels !== 'object') return {};
    return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = String(value ?? '');
      return acc;
    }, {});
  }, [labels]);
  const hasLabels = Object.keys(normalized).length > 0;

  return (
    <div
      style={{
        position: 'relative',
        padding: '6px 10px',
        borderBottom: '1px solid var(--gh-border, #30363d)',
        background: 'var(--gh-bg-sidebar, #161b22)',
        color: 'var(--gh-text, #c9d1d9)',
        minHeight: 40,
        lineHeight: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
        {!hideTitle && name ? <strong style={{ fontSize: 13 }}>{name}</strong> : null}
        {hasLabels ? (
          <LabelsInline labels={normalized} maxVisible={6} style={{ maxWidth: '100%' }} />
        ) : (
          <span style={{ opacity: 0.6, fontSize: 12 }}>-</span>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>{actions}</div>
      )}
    </div>
  );
}
