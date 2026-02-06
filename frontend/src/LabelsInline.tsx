import { useMemo } from 'react';

type LabelsInlineProps = {
  labels?: Record<string, string> | null;
  maxVisible?: number;
  style?: React.CSSProperties;
};

/**
 * Inline labels chip list for summary headers.
 * Shows up to maxVisible labels, then a +N chip.
 * Prevents layout shift by keeping a consistent max height and wrapping avoided.
 */
export default function LabelsInline({ labels, maxVisible = 4, style = {} }: LabelsInlineProps) {
  const chips = useMemo(() => {
    if (!labels || typeof labels !== 'object') return [] as string[];
    const entries = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`);
    if (entries.length <= maxVisible) return entries;
    return [...entries.slice(0, maxVisible), `+${entries.length - maxVisible}`];
  }, [labels, maxVisible]);

  if (!chips.length) {
    return <span style={{ opacity: 0.6, fontSize: 12 }}>-</span>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 6,
        overflow: 'hidden',
        alignItems: 'center',
        maxWidth: '55%',
        ...style,
      }}
      title={Array.isArray(chips) ? chips.join('\n') : ''}
    >
      {chips.map((c, i) => (
        <span
          key={i}
          style={{
            background: 'rgba(56,139,253,0.12)',
            border: '1px solid #30363d',
            padding: '2px 6px',
            borderRadius: 0,
            color: '#c9d1d9',
            fontSize: 12,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            maxWidth: 160,
          }}
        >{c}</span>
      ))}
    </div>
  );
}