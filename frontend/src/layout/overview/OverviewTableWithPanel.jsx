import React, { useState, useEffect, useMemo } from 'react';
import BottomPanel from '../bottompanel/BottomPanel';
import './OverviewTableWithPanel.css';
import CreateManifestOverlay from '../../CreateManifestOverlay';
import { showNotification } from '../../notification.js';

/**
 * Reusable overview table with bottom panel.
 * @param {Object[]} columns - Array of { key, label } for table columns.
 * @param {Object[]} data - Array of row objects.
 * @param {Object[]} tabs - Array of { key, label } for panel tabs.
 * @param {function(row, tab, panelApi): React.ReactNode} renderPanelContent - Function to render panel content for a row and tab.
 * @param {function(row): React.ReactNode} panelHeader - Optional function to render panel header.
 * @param {string} title - Table title.
 * @param {string} [resourceKind] - Kubernetes resource kind for the create overlay (e.g., 'job').
 * @param {string} [namespace] - Current namespace to prefill in Kubernetes manifests.
 * @param {'k8s'|'swarm'} [createPlatform] - Which platform the create overlay should target.
 * @param {string} [createKind] - Kind for the create overlay (overrides resourceKind when provided).
 * @param {string} [createButtonTitle] - Optional title/tooltip for the create (+) button.
 * @param {string|{message:string,type?:'success'|'error'|'warning',duration?:number}} [createNotice] - Optional notification shown when opening create overlay.
 * @param {string} [createHint] - Optional inline hint shown inside the create overlay.
 * @param {string} [tableTestId] - Optional test id for the main table (used by E2E tests).
 * @param {React.ReactNode} [headerActions] - Optional additional actions shown in the header (to the right of the title).
 * @param {function(row, api): Array<{label:string,onClick?:function,disabled?:boolean,danger?:boolean,icon?:React.ReactNode}>} [getRowActions]
 *   Optional per-row extra actions for the row context menu (beyond the default Details).
 *   The api includes: { openDetails(tabKey?:string), setActiveTab(tabKey:string) }.
 */
export default function OverviewTableWithPanel({ columns, data, tabs, renderPanelContent, panelHeader, title, resourceKind, namespace, createPlatform = 'k8s', createKind, createButtonTitle, createNotice, createHint, tableTestId, headerActions, getRowActions }) {
  const [bottomOpen, setBottomOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const safeTabs = Array.isArray(tabs) && tabs.length > 0 ? tabs : [{ key: 'summary', label: 'Summary' }];
  const [activeTab, setActiveTab] = useState(safeTabs[0]?.key || 'summary');
  // Filter text state
  const [filterText, setFilterText] = useState('');
  // Create overlay state
  const [showCreate, setShowCreate] = useState(false);
  // Row actions menu
  const [openMenuKey, setOpenMenuKey] = useState(null);

  const openBottomPanel = (row) => {
    setSelectedRow(row);
    setBottomOpen(true);
    setActiveTab(safeTabs[0]?.key || 'summary');
  };

  const openBottomPanelAtTab = (row, tabKey) => {
    setSelectedRow(row);
    setBottomOpen(true);
    if (tabKey) setActiveTab(tabKey);
    else setActiveTab(safeTabs[0]?.key || 'summary');
  };

  const closeBottomPanel = () => {
    setBottomOpen(false);
    setSelectedRow(null);
    setActiveTab(safeTabs[0]?.key || 'summary'); // Reset to default tab
  };

  const closeRowMenu = () => {
    setOpenMenuKey(null);
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

  // Close the row actions menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!openMenuKey) return;

    const handleClick = (e) => {
      if (e.target.closest('.row-actions-menu') || e.target.closest('.row-actions-button')) return;
      closeRowMenu();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeRowMenu();
      }
    };

    const handleFocusIn = (e) => {
      if (e.target.closest('.row-actions-menu') || e.target.closest('.row-actions-button')) return;
      closeRowMenu();
    };

    const handleWindowBlur = () => {
      closeRowMenu();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [openMenuKey]);

  // Memoized filter to avoid flicker and unnecessary recomputation
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredData = useMemo(() => {
    if (!normalizedFilter) return data;
    try {
      return data.filter((row) =>
        columns.some((col) => {
          const value = row?.[col.accessorKey || col.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(normalizedFilter);
        })
      );
    } catch (_) {
      return data;
    }
  }, [data, columns, normalizedFilter]);

  const handleOpenCreate = () => {
    if (createNotice) {
      const notice = typeof createNotice === 'string' ? { message: createNotice } : createNotice;
      const message = notice?.message;
      if (message) {
        showNotification(message, {
          type: notice?.type || 'warning',
          duration: typeof notice?.duration === 'number' ? notice.duration : 3000,
        });
      }
    }
    setShowCreate(true);
  };

  const getRowKey = (row, idx) => {
    // Include namespace to ensure uniqueness when same-named resources exist across namespaces
    const ns = row?.namespace || row?.Namespace || '';
    const name = row?.id ?? row?.name ?? row?.Name ?? idx;
    return ns ? `${ns}/${name}` : String(name);
  };

  const buildMenuActions = (row) => {
    const api = {
      openDetails: (tabKey) => openBottomPanelAtTab(row, tabKey),
      setActiveTab,
    };
    const extra = typeof getRowActions === 'function' ? (getRowActions(row, api) || []) : [];
    const normalizedExtra = Array.isArray(extra) ? extra.filter(Boolean) : [];
    // Removed Close item - menu closes automatically on click outside, focus loss, or Escape
    return [
      { label: 'Details', icon: '🔎', onClick: () => openBottomPanel(row) },
      ...normalizedExtra,
    ];
  };

  return (
    <div>
      <div className="overview-header">
        {/* Left: create button */}
        <div className="overview-left">
          <button
            title={createButtonTitle || 'Create new'}
            aria-label="Create new"
            onClick={handleOpenCreate}
            className="overview-create-btn"
          >
            +
          </button>
        </div>
        <h2 className="overview-title">{title}</h2>
        <div className="overview-actions">
          {headerActions}
          <input
            type="search"
            placeholder="Filter..."
            aria-label="Filter table"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <table className="gh-table" data-testid={tableTestId} style={{ width: '100%' }}>
        <thead>
          <tr>
            {columns.map(col => <th key={col.accessorKey || col.key}>{col.header || col.label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, idx) => (
            !row ? null : (
              <tr key={getRowKey(row, idx)} style={{ cursor: 'pointer' }} onClick={() => openBottomPanel(row)}>
                {columns.map((col, colIdx) => (
                  <td key={`${row.name || idx}-${col.accessorKey || col.key || colIdx}`}>
                    {col.cell ? col.cell({ getValue: () => row[col.accessorKey || col.key] }) : row[col.accessorKey || col.key]}
                  </td>
                ))}
                <td style={{ position: 'relative', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="row-actions-button"
                    aria-label="Row actions"
                    title="Actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      const key = getRowKey(row, idx);
                      setOpenMenuKey((cur) => (cur === key ? null : key));
                    }}
                  >···
                  </button>

                  {openMenuKey === getRowKey(row, idx) && (
                    <div
                      className="menu-content row-actions-menu"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        background: 'var(--gh-table-header-bg, #2d323b)',
                        border: '1px solid #353a42',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        zIndex: 1200,
                        minWidth: 180,
                        textAlign: 'left',
                        padding: '4px 0',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const menuActions = buildMenuActions(row);
                        return menuActions.map((a, i) => {
                        const disabled = Boolean(a?.disabled);
                        const danger = Boolean(a?.danger);
                        return (
                          <div
                            key={`${a?.label || 'action'}-${i}`}
                            className="context-menu-item"
                            style={{
                              padding: '8px 16px',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              color: danger ? '#f85149' : '#fff',
                              opacity: disabled ? 0.55 : 1,
                              fontSize: 15,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                            onClick={() => {
                              if (disabled) return;
                              try {
                                a?.onClick?.(row);
                              } finally {
                                closeRowMenu();
                              }
                            }}
                          >
                            {a?.icon ? (
                              <span aria-hidden="true" style={{ width: 18, display: 'inline-block', textAlign: 'center' }}>{a.icon}</span>
                            ) : (
                              <span aria-hidden="true" style={{ width: 18, display: 'inline-block' }} />
                            )}
                            <span>{a?.label}</span>
                          </div>
                        );
                        });
                      })()}
                    </div>
                  )}
                </td>
              </tr>
            )
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
        tabs={safeTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        headerRight={selectedRow && panelHeader ? panelHeader(selectedRow) : null}
      >
        {selectedRow && typeof renderPanelContent === 'function'
          ? renderPanelContent(selectedRow, activeTab, { activeTab, setActiveTab })
          : null}
      </BottomPanel>

      {/* Create manifest overlay */}
      <CreateManifestOverlay
        open={showCreate}
        platform={createPlatform}
        kind={createKind ?? resourceKind}
        namespace={namespace}
        createHint={createHint}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
