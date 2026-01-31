import { useState, useEffect, useMemo, useCallback } from 'react';
import BottomPanel from '../bottompanel/BottomPanel';
import './OverviewTableWithPanel.css';
import './BulkSelection.css';
import CreateManifestOverlay from '../../CreateManifestOverlay';
import { showNotification } from '../../notification.js';
import { fetchTabCounts } from '../../api/tabCounts';
import StatusBadge from '../../components/StatusBadge.jsx';
import { getColumnKey, pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting.js';
import { useTableSelection } from '../../hooks/useTableSelection';
import BulkActionBar from '../../components/BulkActionBar';
import BulkConfirmDialog from '../../components/BulkConfirmDialog';
import BulkProgressDialog from '../../components/BulkProgressDialog';
import { executeBulkAction } from '../../api/bulkOperations';

const STATUS_BADGE_KEYS = new Set(['status', 'state', 'availability', 'phase']);

/**
 * Reusable overview table with bottom panel.
 * @param {Object[]} columns - Array of { key, label } for table columns.
 * @param {Object[]} data - Array of row objects.
 * @param {Object[]} tabs - Array of { key, label, countKey?, countable? } for panel tabs.
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
 * @param {function(row): (Promise<Object>|Object)} [tabCountsFetcher] - Optional async function to fetch tab counts for a row.
 * @param {boolean} [enableTabCounts=true] - Whether to fetch and display tab counts.
 * @param {boolean} [enableBulkSelection=true] - Whether to enable bulk selection checkboxes.
 * @param {function(result): void} [onBulkOperationComplete] - Optional callback when bulk operation completes.
 */
export default function OverviewTableWithPanel({ columns, data, tabs, renderPanelContent, panelHeader, title, resourceKind, namespace, createPlatform = 'k8s', createKind, createButtonTitle, createNotice, createHint, tableTestId, headerActions, getRowActions, tabCountsFetcher, enableTabCounts = true, enableBulkSelection = true, onBulkOperationComplete }) {
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
  // Tab counts state
  const [tabCounts, setTabCounts] = useState({});
  const [tabCountsLoading, setTabCountsLoading] = useState(false);
  
  // Bulk operation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [progressDialog, setProgressDialog] = useState(null);

  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' }));

  useEffect(() => {
    if (!defaultSortKey) return;
    setSortState((cur) => {
      const curKey = cur?.key;
      const hasKey = columns.some((col) => getColumnKey(col) === curKey);
      if (curKey && hasKey) return cur;
      return { key: defaultSortKey, direction: 'asc' };
    });
  }, [columns, defaultSortKey]);

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
    setTabCounts({}); // Clear tab counts when closing
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch tab counts when a row is selected
  useEffect(() => {
    if (!selectedRow || !enableTabCounts) {
      setTabCounts({});
      return;
    }

    // Check if any tabs are countable
    const hasCountableTabs = safeTabs.some(t => t.countable !== false && t.countKey);
    if (!hasCountableTabs) {
      return;
    }

    if (!tabCountsFetcher && !resourceKind) {
      return;
    }

    const kind = resourceKind || 'Unknown';
    const name = selectedRow?.name || selectedRow?.Name;
    const ns = selectedRow?.namespace || selectedRow?.Namespace;

    let cancelled = false;
    // Only show loading indicator on initial load (when no counts exist)
    // This prevents badge flickering when counts are being refreshed
    const isInitialLoad = Object.keys(tabCounts).length === 0;
    if (isInitialLoad) {
      setTabCountsLoading(true);
    }

    const fetchCounts = async () => {
      if (typeof tabCountsFetcher === 'function') {
        return await tabCountsFetcher(selectedRow);
      }
      if (!name) {
        return {};
      }
      return fetchTabCounts(kind, ns, name);
    };

    Promise.resolve()
      .then(fetchCounts)
      .then(counts => {
        if (!cancelled) {
          setTabCounts(counts || {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Keep existing counts on error to prevent flicker
          // Only clear if this was the initial load
          if (isInitialLoad) {
            setTabCounts({});
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTabCountsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRow, enableTabCounts, resourceKind, safeTabs, tabCountsFetcher]);

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

  const sortedData = useMemo(() => {
    if (!sortState?.key) return filteredData;
    return sortRows(filteredData, sortState.key, sortState.direction);
  }, [filteredData, sortState]);

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

  // Bulk selection hook
  const {
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    toggleAll,
    toggleRow,
    clearSelection,
    isSelected,
    getSelectedRows
  } = useTableSelection(enableBulkSelection ? sortedData : [], getRowKey);

  // Get selected items formatted for the API
  // Use createKind as fallback for Swarm tables which use createKind instead of resourceKind
  const effectiveKind = createKind || resourceKind || 'unknown';
  const selectedItems = useMemo(() => {
    if (!enableBulkSelection) return [];
    const rows = getSelectedRows();
    return rows.map((row) => ({
      name: row?.name || row?.Name || '',
      namespace: row?.namespace || row?.Namespace || '',
      id: row?.id || row?.ID || row?.Id || '',
      kind: effectiveKind,
      displayName: getRowKey(row, 0)
    }));
  }, [getSelectedRows, effectiveKind, enableBulkSelection, getRowKey]);

  // Handle action selection from BulkActionBar
  const handleBulkActionSelect = useCallback((action, options) => {
    setConfirmDialog({
      action,
      items: selectedItems,
      options,
      title: `${action.label} ${selectedItems.length} ${effectiveKind || 'item'}${selectedItems.length > 1 ? 's' : ''}?`,
      destructive: action.destructive
    });
  }, [selectedItems, effectiveKind]);

  // Handle bulk operation confirmation
  const handleBulkConfirm = useCallback(async () => {
    const { action, items, options } = confirmDialog;
    setConfirmDialog(null);

    // Initialize progress dialog
    const progressItems = items.map(item => ({
      id: item.displayName,
      name: item.displayName,
      namespace: item.namespace,
      status: 'pending',
      error: null
    }));

    setProgressDialog({
      title: `${action.label} in progress...`,
      items: progressItems,
      isComplete: false,
      successCount: 0,
      errorCount: 0
    });

    try {
      const result = await executeBulkAction(createPlatform, action.id, items, {
        ...options,
        resourceKind: effectiveKind
      });

      const updatedItems = progressItems.map((item, idx) => {
        const resultItem = result.results?.[idx];
        return {
          ...item,
          status: resultItem?.success ? 'success' : 'error',
          error: resultItem?.error || null
        };
      });

      setProgressDialog({
        title: `${action.label} complete`,
        items: updatedItems,
        isComplete: true,
        successCount: result.successCount || 0,
        errorCount: result.errorCount || 0
      });

      if (result.errorCount === 0) {
        clearSelection();
      }

      if (onBulkOperationComplete) {
        onBulkOperationComplete(result);
      }
    } catch (error) {
      const failedItems = progressItems.map(item => ({
        ...item,
        status: 'error',
        error: error.message || 'Operation failed'
      }));

      setProgressDialog({
        title: `${action.label} failed`,
        items: failedItems,
        isComplete: true,
        successCount: 0,
        errorCount: progressItems.length
      });
    }
  }, [confirmDialog, createPlatform, effectiveKind, clearSelection, onBulkOperationComplete]);

  const handleProgressClose = useCallback(() => {
    setProgressDialog(null);
  }, []);

  const handleRetryFailed = useCallback(() => {
    if (progressDialog && confirmDialog) {
      const failedItems = progressDialog.items
        .filter(item => item.status === 'error')
        .map(item => ({
          name: item.name.includes('/') ? item.name.split('/').pop() : item.name,
          namespace: item.namespace,
          kind: effectiveKind,
          displayName: item.name
        }));

      if (failedItems.length > 0) {
        setProgressDialog(null);
        setConfirmDialog({
          ...confirmDialog,
          items: failedItems
        });
      }
    }
  }, [progressDialog, confirmDialog, effectiveKind]);

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
    <div className={enableBulkSelection ? 'bulk-operations-wrapper' : ''}>
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
          {enableBulkSelection && selectedCount > 0 && (
            <BulkActionBar
              selectedCount={selectedCount}
              resourceKind={effectiveKind}
              platform={createPlatform}
              onActionSelect={handleBulkActionSelect}
              onClearSelection={clearSelection}
              variant="compact"
            />
          )}
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

      <table className="gh-table" data-testid={tableTestId} style={{ width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          {enableBulkSelection && <col style={{ width: '40px' }} />}
          {columns.map((col, idx) => (
            <col key={col.accessorKey || col.key || idx} style={{ width: col.width || 'auto' }} />
          ))}
          <col style={{ width: '100px' }} />
        </colgroup>
        <thead>
          <tr>
            {enableBulkSelection && (
              <th className="bulk-select-header">
                <input
                  type="checkbox"
                  className="bulk-checkbox bulk-checkbox-all"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((col) => {
              const key = col.accessorKey || col.key;
              const isActive = key && sortState?.key === key;
              const direction = isActive ? sortState?.direction : undefined;
              return (
                <th key={key || col.header || col.label} aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
                  <button
                    type="button"
                    className="sortable-header"
                    onClick={() => key && setSortState((cur) => toggleSortState(cur, key))}
                  >
                    <span>{col.header || col.label}</span>
                    <span className="sortable-indicator" aria-hidden="true">
                      {isActive ? (direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            !row ? null : (
              <tr 
                key={getRowKey(row, idx)} 
                style={{ cursor: 'pointer' }} 
                onClick={() => openBottomPanel(row)}
                className={enableBulkSelection && isSelected(row, idx) ? 'bulk-selected' : ''}
              >
                {enableBulkSelection && (
                  <td className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={isSelected(row, idx)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRow(row, idx, e.shiftKey);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${row?.name || row?.Name || 'item'}`}
                    />
                  </td>
                )}
                {columns.map((col, colIdx) => (
                  <td key={`${row.name || idx}-${col.accessorKey || col.key || colIdx}`}>
                    {(() => {
                      const key = col.accessorKey || col.key;
                      const rawValue = key ? row[key] : undefined;
                      if (!col.cell && key && STATUS_BADGE_KEYS.has(String(key).toLowerCase())) {
                        if (rawValue === null || rawValue === undefined || rawValue === '') return '-';
                        return <StatusBadge status={String(rawValue)} size="small" />;
                      }
                      return col.cell ? col.cell({ getValue: () => row[key] }) : rawValue;
                    })()}
                  </td>
                ))}
                <td style={{ position: 'relative', textAlign: 'right', overflow: 'visible' }}>
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
        tabCounts={tabCounts}
        tabCountsLoading={tabCountsLoading}
      >
        {selectedRow && typeof renderPanelContent === 'function'
          ? renderPanelContent(selectedRow, activeTab, { activeTab, setActiveTab, tabCounts })
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

      {/* Bulk operation confirmation dialog */}
      {confirmDialog && (
        <BulkConfirmDialog
          open={true}
          actionLabel={confirmDialog.action?.label || 'Delete'}
          items={confirmDialog.items}
          danger={confirmDialog.destructive}
          onConfirm={handleBulkConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Bulk operation progress dialog */}
      {progressDialog && (
        <BulkProgressDialog
          open={true}
          title={progressDialog.title}
          items={progressDialog.items}
          completed={progressDialog.successCount + progressDialog.errorCount}
          total={progressDialog.items?.length || 0}
          onClose={handleProgressClose}
          onRetryFailed={handleRetryFailed}
        />
      )}
    </div>
  );
}
