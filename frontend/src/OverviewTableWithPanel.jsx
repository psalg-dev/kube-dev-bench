import React, { useState, useEffect, useMemo } from 'react';
import BottomPanel from './BottomPanel';
import './OverviewTableWithPanel.css';
import CreateManifestOverlay from './CreateManifestOverlay';

/**
 * Reusable overview table with bottom panel.
 * @param {Object[]} columns - Array of { key, label } for table columns.
 * @param {Object[]} data - Array of row objects.
 * @param {Object[]} tabs - Array of { key, label } for panel tabs.
 * @param {function(row, tab): React.ReactNode} renderPanelContent - Function to render panel content for a row and tab.
 * @param {function(row): React.ReactNode} panelHeader - Optional function to render panel header.
 * @param {string} title - Table title.
 * @param {string} [resourceKind] - Kubernetes resource kind for the create-manifest overlay (e.g., 'job').
 * @param {string} [namespace] - Current namespace to prefill in manifests.
 */
export default function OverviewTableWithPanel({ columns, data, tabs, renderPanelContent, panelHeader, title, resourceKind, namespace }) {
  const [bottomOpen, setBottomOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'summary');
  // Filter text state
  const [filterText, setFilterText] = useState('');
  // Create overlay state
  const [showCreate, setShowCreate] = useState(false);

  const openBottomPanel = (row) => {
    setSelectedRow(row);
    setBottomOpen(true);
    setActiveTab(tabs[0]?.key || 'summary');
  };

  const closeBottomPanel = () => {
    setBottomOpen(false);
    setSelectedRow(null);
    setActiveTab(tabs[0]?.key || 'summary'); // Reset to default tab
  };

  useEffect(() => {
    if (!bottomOpen) return;
    const handleClick = (e) => {
      // Don't close if we're resizing or if the click is within the bottom panel
      if (e.target.closest('.bottom-panel') ||
          e.target.closest('[data-resizing]') ||
          document.body.style.cursor === 'ns-resize') {
        return;
      }
      closeBottomPanel();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeBottomPanel();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bottomOpen]);

  // Memoized filter to avoid flicker and unnecessary recomputation
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredData = useMemo(() => {
    if (!normalizedFilter) return data;
    try {
      return data.filter((row) =>
        columns.some((col) => {
          const value = row?.[col.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(normalizedFilter);
        })
      );
    } catch (_) {
      return data;
    }
  }, [data, columns, normalizedFilter]);

  return (
    <div>
      <div className="overview-header">
        {/* Left: create button */}
        <div className="overview-left">
          <button
            title="Create new"
            aria-label="Create new"
            onClick={() => setShowCreate(true)}
            className="overview-create-btn"
          >
            +
          </button>
        </div>
        <h2 className="overview-title">{title}</h2>
        <div className="overview-actions">
          <input
            type="search"
            placeholder="Filter..."
            aria-label="Filter table"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <table className="gh-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            {columns.map(col => <th key={col.key}>{col.label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, idx) => (
            <tr key={row.name || idx} style={{ cursor: 'pointer' }} onClick={() => openBottomPanel(row)}>
              {columns.map(col => <td key={col.key}>{row[col.key]}</td>)}
              <td>
                <button onClick={e => { e.stopPropagation(); openBottomPanel(row); }} style={{ padding: '2px 8px' }}>Details</button>
              </td>
            </tr>
          ))}
          {filteredData.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="main-panel-loading">No rows match the filter.</td>
            </tr>
          )}
        </tbody>
      </table>
      <BottomPanel
        open={bottomOpen}
        onClose={closeBottomPanel}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        headerRight={selectedRow && panelHeader ? panelHeader(selectedRow) : null}
      >
        {selectedRow && renderPanelContent(selectedRow, activeTab)}
      </BottomPanel>

      {/* Create manifest overlay */}
      <CreateManifestOverlay
        open={showCreate}
        kind={resourceKind}
        namespace={namespace}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
