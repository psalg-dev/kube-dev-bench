type GraphFilterState = Record<string, boolean>;

export interface GraphToolbarProps {
  depth: number;
  onDepthChange: (_value: number) => void;
  loading?: boolean;
  onRefresh: () => void;
  filters: GraphFilterState;
  onToggleFilter: (_filterKey: string) => void;
}
const FILTER_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'pod', label: 'Pods' },
  { key: 'configmap', label: 'ConfigMaps' },
  { key: 'secret', label: 'Secrets' },
  { key: 'service', label: 'Services' },
  { key: 'storage', label: 'Storage' },
];

export function GraphToolbar({
  depth,
  onDepthChange,
  loading,
  onRefresh,
  filters,
  onToggleFilter,
}: GraphToolbarProps) {
  return (
    <div className="graph-toolbar" id="graph-toolbar">
      <div className="toolbar-left">
        <span className="toolbar-label">Depth:</span>
        <select
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className="depth-selector"
          aria-label="Graph depth"
        >
          <option value={1}>1 level</option>
          <option value={2}>2 levels</option>
          <option value={3}>3 levels</option>
        </select>
      </div>

      <div className="toolbar-filters">
        {FILTER_ITEMS.map((item) => (
          <label key={item.key} className="toolbar-filter-item">
            <input
              type="checkbox"
              checked={Boolean(filters[item.key])}
              onChange={() => onToggleFilter(item.key)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <div className="toolbar-right">
        <button
          id="graph-refresh-btn"
          onClick={onRefresh}
          className="refresh-button"
          disabled={Boolean(loading)}
        >
          <span className="refresh-icon">↻</span>
          Refresh
        </button>
      </div>
    </div>
  );
}
