// filepath: frontend/src/SummaryHeader.jsx
import { useMemo } from 'react';
import LabelsInline from '../../LabelsInline.jsx';

/**
 * Generic summary header used in bottom panel summary tabs.
 * Updated: Removed centered "Summary for <name>" title. Now header just shows labels (or '-' if none) left-aligned.
 * hideTitle is retained for backward compatibility but has no visual difference now.
 */
export default function SummaryTabHeader({ _name, labels, _hideTitle = false, actions = null }) { // name kept in signature in case future use
  const normalized = useMemo(() => {
    if (!labels || typeof labels !== 'object') return {};
    return labels;
  }, [labels]);
  const hasLabels = Object.keys(normalized).length > 0;

  // Single unified rendering (previous hideTitle path) so that the old title (1) disappears and labels (2) fill the space.
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
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
        {hasLabels ? (
          <LabelsInline labels={normalized} maxVisible={6} style={{ maxWidth: '100%' }} />
        ) : (
          <span style={{ opacity: 0.6, fontSize: 12 }}>-</span>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
