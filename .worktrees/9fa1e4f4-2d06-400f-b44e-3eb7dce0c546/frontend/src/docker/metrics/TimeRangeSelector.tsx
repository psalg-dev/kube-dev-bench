const OPTIONS = [
  { value: '60', label: 'Last 1 minute' },
  { value: '300', label: 'Last 5 minutes' },
  { value: '900', label: 'Last 15 minutes' },
  { value: '3600', label: 'Last 1 hour' },
  { value: '0', label: 'All (in-memory)' },
];

type TimeRangeSelectorProps = {
  valueSeconds: number;
  onChangeSeconds?: (_value: number) => void;
  disabled?: boolean;
};
export default function TimeRangeSelector({ valueSeconds, onChangeSeconds, disabled = false }: TimeRangeSelectorProps) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
      Range
      <select
        id="swarm-metrics-range"
        value={String(valueSeconds)}
        disabled={disabled}
        onChange={(e) => onChangeSeconds?.(Number(e.target.value))}
        style={{
          padding: '4px 8px',
          border: '1px solid var(--gh-border, #30363d)',
          background: 'rgba(110,118,129,0.06)',
          color: 'var(--gh-text, #c9d1d9)',
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}