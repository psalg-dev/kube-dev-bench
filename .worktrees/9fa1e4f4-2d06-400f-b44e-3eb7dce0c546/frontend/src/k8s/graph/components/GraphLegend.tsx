const LEGEND_ITEMS = [
  { label: 'owns', style: { borderTop: '2px solid #64748b' } },
  { label: 'selects', style: { borderTop: '2px dashed #3b82f6' } },
  { label: 'mounts', style: { borderTop: '2px dotted #10b981' } },
  { label: 'routes to', style: { borderTop: '3px solid #f97316' } },
  { label: 'bound to', style: { borderTop: '2px solid #14b8a6' } },
  { label: 'scales', style: { borderTop: '2px solid #0ea5e9' } },
  { label: 'ingress', style: { borderTop: '2px solid #10b981' } },
  { label: 'egress', style: { borderTop: '2px solid #ef4444' } },
];

export function GraphLegend() {
  return (
    <div className="graph-legend" id="graph-legend">
      <div className="legend-title">Legend</div>
      <div className="legend-items">
        {LEGEND_ITEMS.map((item) => (
          <div className="legend-item" key={item.label}>
            <div className="legend-line" style={item.style}></div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
