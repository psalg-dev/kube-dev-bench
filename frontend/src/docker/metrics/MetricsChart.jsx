export default function MetricsChart({
  points,
  valueKey,
  valueFn,
  width = 360,
  height = 64,
  color = '#58a6ff',
  emptyText = 'No data yet',
}) {
  const data = Array.isArray(points) ? points : [];
  const values = data
    .map((p) => {
      if (typeof valueFn === 'function') return Number(valueFn(p));
      return Number(p?.[valueKey] ?? 0);
    })
    .filter((v) => Number.isFinite(v));

  if (values.length < 2) {
    return (
      <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
        {emptyText}
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 1 - ((v - min) / span) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', maxWidth: '100%' }}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
