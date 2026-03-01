import ConfigDataTab from './ConfigDataTab.jsx';

/**
 * Wrapper component to show config data in the summary panel.
 * This provides a consistent section layout with the data viewer.
 */
export default function ConfigDataSection({ configId, configName }) {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', padding: '12px 16px 8px', borderBottom: '1px solid var(--gh-border, #30363d)' }}>
        Config Data
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ConfigDataTab configId={configId} configName={configName} />
      </div>
    </div>
  );
}
