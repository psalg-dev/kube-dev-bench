import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import BottomPanel from '../bottompanel/BottomPanel';
import './OverviewTableWithPanel.css';
import './BulkSelection.css';
import CreateManifestOverlay from '../../CreateManifestOverlay';
import { showNotification, showError, showSuccess } from '../../notification';
import { fetchTabCounts } from '../../api/tabCounts';
import StatusBadge from '../../components/StatusBadge';
import { getColumnKey, pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting';
import BulkActionBar from '../../components/BulkActionBar';
import useTableSelection from '../../hooks/useTableSelection';
import { getBulkActionsForResource, type BulkAction } from '../../constants/bulkActions';
import { executeBulkAction } from '../../api/bulkOperations';

const STATUS_BADGE_KEYS = new Set(['status', 'state', 'availability', 'phase']);

type ColumnDef = {
  key?: string;
  label?: string;
  header?: string;
  accessorKey?: string;
  width?: string | number;
  cell?: (ctx: { getValue: () => any }) => ReactNode;
};

type TabDef = {
  key: string;
  label: string;
  countKey?: string;
  countable?: boolean;
};

type RowAction = {
  label: string;
  onClick?: (row: any) => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: ReactNode;
};

type OverviewTableWithPanelProps = {
  columns: ColumnDef[];
  data: any[];
  tabs?: TabDef[];
  renderPanelContent?: (row: any, tab: string, panelApi: { activeTab: string; setActiveTab: (key: string) => void; tabCounts: Record<string, number> }) => ReactNode;
  panelHeader?: (row: any) => ReactNode;
  title: string;
  resourceKind?: string;
  namespace?: string;
  loading?: boolean;
  error?: string | null;
  onCreateResource?: () => void;
  createPlatform?: 'k8s' | 'swarm';
  createKind?: string;
  createButtonTitle?: string;
  createNotice?: string | { message: string; type?: 'success' | 'error' | 'warning'; duration?: number };
  createHint?: string;
  tableTestId?: string;
  headerActions?: ReactNode;
  getRowActions?: (row: any, api: { openDetails: (tabKey?: string) => void; setActiveTab: (key: string) => void }) => RowAction[];
  tabCountsFetcher?: (row: any) => Promise<Record<string, number>> | Record<string, number>;
  enableTabCounts?: boolean;
  bulkActions?: BulkAction[];
  bulkResourceKind?: string;
};

/**
 * Reusable overview table with bottom panel.
 */
export default function OverviewTableWithPanel({
  columns,
  data,
  tabs,
  renderPanelContent,
  panelHeader,
  title,
  resourceKind,
  namespace,
  loading,
  onCreateResource,
  createPlatform = 'k8s',
  createKind,
  createButtonTitle,
  createNotice,
  createHint,
  tableTestId,
  headerActions,
  getRowActions,
  tabCountsFetcher,
  enableTabCounts = true,
  bulkActions,
  bulkResourceKind,
}: OverviewTableWithPanelProps) {
  const [bottomOpen, setBottomOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const safeTabs = Array.isArray(tabs) && tabs.length > 0 ? tabs : [{ key: 'summary', label: 'Summary' }];
  const [activeTab, setActiveTab] = useState(safeTabs[0]?.key || 'summary');
  // Filter text state
  const [filterText, setFilterText] = useState('');
  // Create overlay state
  const [showCreate, setShowCreate] = useState(false);
  // Row actions menu
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  // Tab counts state
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [tabCountsLoading, setTabCountsLoading] = useState(false);

  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' as 'asc' | 'desc' }));

  useEffect(() => {
    if (!defaultSortKey) return;
    setSortState((cur) => {
      const curKey = cur?.key;
      const hasKey = columns.some((col) => getColumnKey(col) === curKey);
      if (curKey && hasKey) return cur;
      return { key: defaultSortKey, direction: 'asc' };
    });
  }, [columns, defaultSortKey]);

  const openBottomPanel = (row: any) => {
    setSelectedRow(row);
    setBottomOpen(true);
    setActiveTab(safeTabs[0]?.key || 'summary');
  };

  const openBottomPanelAtTab = (row: any, tabKey?: string) => {
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
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't close if we're resizing or if the click is within the bottom panel
      if (target?.closest('.bottom-panel') ||
          target?.closest('[data-resizing]') ||
          document.body.style.cursor === 'ns-resize') {
        return;
      }
      closeBottomPanel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
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

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.row-actions-menu') || target?.closest('.row-actions-button')) return;
      closeRowMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRowMenu();
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.row-actions-menu') || target?.closest('.row-actions-button')) return;
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
    const name = (selectedRow as any)?.name || (selectedRow as any)?.Name;
    const ns = (selectedRow as any)?.namespace || (selectedRow as any)?.Namespace;

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
        return {} as Record<string, number>;
      }
      return fetchTabCounts(kind, ns, name);
    };

    Promise.resolve()
      .then(fetchCounts)
      .then((counts) => {
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
          const value = (row as any)?.[col.accessorKey || col.key as string];
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

  const getRowKey = (row: any, _idx: number) => {
    // Prefer stable unique identifiers: metadata.uid or provided uid fields.
    // Fallback to namespace + name which is also stable across sorts.
    const ns = row?.namespace || row?.Namespace || '';
    const uid = row?.uid ?? row?.UID ?? row?.metadata?.uid ?? null;
    const name = row?.id ?? row?.name ?? row?.Name ?? null;
    if (uid) return String(uid);
    if (name) return ns ? `${ns}/${String(name)}` : String(name);
    // Last resort: JSON-stringify the row to produce a deterministic key
    return String(JSON.stringify(row));
  };

  const resolvedBulkActions = useMemo(() => {
    if (Array.isArray(bulkActions)) return bulkActions;
    const inferredKind = bulkResourceKind || resourceKind || createKind;
    return getBulkActionsForResource({ platform: createPlatform, kind: inferredKind });
  }, [bulkActions, bulkResourceKind, resourceKind, createKind, createPlatform]);

  const bulkEnabled = resolvedBulkActions.length > 0;
  const selection: any = useTableSelection(data, getRowKey, sortedData);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!bulkEnabled || !selectAllRef.current) return;
    selectAllRef.current.indeterminate = selection.isIndeterminate;
  }, [bulkEnabled, selection.isIndeterminate, selection.isAllSelected]);

  useEffect(() => {
    if (!bulkEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selection.toggleAll();
        return;
      }
      if (e.key === 'Escape') {
        selection.clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bulkEnabled, selection]);

  const handleOpenCreate = () => {
    if (typeof onCreateResource === 'function') {
      onCreateResource();
      return;
    }
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

  const handleBulkAction = useCallback(async (action: BulkAction) => {
    if (!bulkEnabled || !action) return;
    const selectedRows = selection.getSelectedRows(sortedData);
    if (selectedRows.length === 0) return;

    if (action.confirm) {
      const ok = window.confirm(`${action.label} ${selectedRows.length} selected item(s)?`);
      if (!ok) return;
    }

    const options: Record<string, any> = {};
    if (action.promptReplicas) {
      const current = selectedRows[0]?.replicas ?? selectedRows[0]?.Replicas ?? 0;
      const raw = window.prompt('Enter desired replica count:', String(current ?? 0));
      if (raw === null) return;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        showError('Replica count must be a non-negative number.');
        return;
      }
      options.replicas = Math.floor(parsed);
    }

    try {
      const summary = await executeBulkAction({
        platform: createPlatform,
        kind: bulkResourceKind || resourceKind || createKind,
        actionKey: action.key,
        rows: selectedRows,
        options,
      });
      if (summary.failed === 0) {
        showSuccess(`${action.label} succeeded for ${summary.succeeded} item(s).`);
      } else {
        showError(`${action.label} completed with ${summary.failed} failure(s).`);
      }
      selection.clearSelection();
    } catch (err: any) {
      showError(`${action.label} failed: ${err?.message || String(err)}`);
    }
  }, [bulkEnabled, selection, sortedData, createPlatform, resourceKind, createKind, bulkResourceKind]);

  const buildMenuActions = (row: any) => {
    const api = {
      openDetails: (tabKey?: string) => openBottomPanelAtTab(row, tabKey),
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
          {bulkEnabled && (
            <BulkActionBar
              selectedCount={selection.selectedCount}
              actions={resolvedBulkActions}
              onAction={handleBulkAction}
              onClear={selection.clearSelection}
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
          {bulkEnabled && <col className="bulk-checkbox-col" />}
          {columns.map((col, idx) => (
            <col key={col.accessorKey || col.key || idx} style={{ width: col.width || 'auto' }} />
          ))}
          <col style={{ width: '100px' }} />
        </colgroup>
        <thead>
          <tr>
            {bulkEnabled && (
              <th className="bulk-checkbox-col" aria-label="Select all">
                <input
                  ref={selectAllRef}
                  className="bulk-select-all"
                  type="checkbox"
                  checked={selection.isAllSelected}
                  onChange={() => selection.toggleAll()}
                  onClick={(e) => e.stopPropagation()}
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
          {sortedData.map((row: any, idx: number) => (
            !row ? null : (
              <tr
                key={getRowKey(row, idx)}
                className={bulkEnabled && selection.isSelected(getRowKey(row, idx)) ? 'bulk-selected' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  if (bulkEnabled && e.shiftKey) {
                    e.preventDefault();
                    selection.toggleRow(getRowKey(row, idx), idx, true);
                    return;
                  }
                  openBottomPanel(row);
                }}
              >
                {bulkEnabled && (
                  <td className="bulk-checkbox-col" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="bulk-row-checkbox"
                      type="checkbox"
                      checked={selection.isSelected(getRowKey(row, idx))}
                      onClick={(e) => {
                        e.stopPropagation();
                        selection.toggleRow(getRowKey(row, idx), idx, e.shiftKey);
                      }}
                      onChange={() => {}}
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
                      if (!key) return rawValue;
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
                        return menuActions.map((a: RowAction, i: number) => {
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
              <td colSpan={columns.length + 1 + (bulkEnabled ? 1 : 0)} className="main-panel-loading">No rows match the filter.</td>
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
    </div>
  );
}
