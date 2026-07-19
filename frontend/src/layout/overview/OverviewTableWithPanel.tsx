/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { executeBulkAction } from '../../api/bulkOperations';
import { fetchTabCounts } from '../../api/tabCounts';
import { DataTable, type RowAction as RowActionType } from '../../components/DataTable';
import { getBulkActionsForResource, type BulkAction } from '../../constants/bulkActions';
import CreateManifestOverlay from '../../CreateManifestOverlay';
import { showError, showNotification, showSuccess } from '../../notification';
import BottomPanel from '../bottompanel/BottomPanel';
import { adaptColumnsForDataTable } from './columnAdapter';
import { BaseModal, ModalButton, ModalDangerButton, ModalPrimaryButton } from '../../components/BaseModal';
import { ColumnVisibilityMenu } from '../../components/DataTable/ColumnVisibilityMenu';
import './BulkSelection.css';
import './OverviewTableWithPanel.css';

type Row = Record<string, unknown>;

type ColumnDef = {
  key?: string;
  label?: string;
  header?: string;
  accessorKey?: string;
  width?: string | number;
  cell?: (_ctx: { getValue: () => any }) => ReactNode;
};

type TabDef = {
  key: string;
  label: string;
  countKey?: string;
  countable?: boolean;
  testId?: string;
};

type RowAction = {
  label: string;
  onClick?: (_row: any) => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: ReactNode;
};

type OverviewTableWithPanelProps = {
  columns: ColumnDef[];
  data: any[];
  tabs?: TabDef[];
  renderPanelContent?: (_row: any, _tab: string, _panelApi: { activeTab: string; setActiveTab: (_key: string) => void; tabCounts: Record<string, number>; refresh?: () => void; openDetails?: (_tabKey?: string) => void }) => ReactNode;
  panelHeader?: (_row: any) => ReactNode;
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
  getRowActions?: (_row: any, _api: { openDetails: (_tabKey?: string) => void; setActiveTab: (_key: string) => void; refresh?: () => void }) => RowAction[];
  tabCountsFetcher?: (_row: any) => Promise<Record<string, number>> | Record<string, number>;
  enableTabCounts?: boolean;
  bulkActions?: BulkAction[];
  bulkResourceKind?: string;
  /** Refetch the table data (from useResourceData) so panel/row actions can refresh after mutations. */
  onRefreshData?: () => void;
};

/**
 * Reusable overview table with bottom panel.
 * Uses DataTable engine internally for sorting, filtering, column management.
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
  onRefreshData,
}: OverviewTableWithPanelProps) {
  const [bottomOpen, setBottomOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const safeTabs = useMemo(
    () => (Array.isArray(tabs) && tabs.length > 0 ? tabs : [{ key: 'summary', label: 'Summary' }]),
    [tabs]
  );
  const [activeTab, setActiveTab] = useState(safeTabs[0]?.key || 'summary');
  const [showCreate, setShowCreate] = useState(false);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [tabCountsLoading, setTabCountsLoading] = useState(false);
  const tabCountsInitializedRef = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showScalePrompt, setShowScalePrompt] = useState(false);
  const [bulkActionToDelete, setBulkActionToDelete] = useState<{ action: BulkAction; rows: Row[] } | null>(null);
  const [scaleAction, setScaleAction] = useState<{ action: BulkAction; rows: Row[] } | null>(null);
  const [columnVisibilityMenuOpen, setColumnVisibilityMenuOpen] = useState(false);

  const openBottomPanel = (row: Row) => {
    setSelectedRow(row);
    setBottomOpen(true);
    setActiveTab(safeTabs[0]?.key || 'summary');
  };

  const openBottomPanelAtTab = (row: Row, tabKey?: string) => {
    setSelectedRow(row);
    setBottomOpen(true);
    if (tabKey) setActiveTab(tabKey);
    else setActiveTab(safeTabs[0]?.key || 'summary');
  };

  const closeBottomPanel = () => {
    setBottomOpen(false);
    setSelectedRow(null);
    setActiveTab(safeTabs[0]?.key || 'summary');
    setTabCounts({});
  };

  useEffect(() => {
    if (!bottomOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.bottom-panel') ||
          target?.closest('[data-resizing]') ||
          // A confirm/prompt modal (ModalProvider) spawned from a panel action renders
          // outside the panel DOM; clicking it must not close the panel underneath.
          target?.closest('.base-modal-overlay') ||
          // A click on a data row opens that row's panel (via the row's onClick); it must not
          // be treated as a click-outside-to-close, or the close races the open and can win.
          target?.closest('.data-table tbody tr') ||
          document.body.style.cursor === 'ns-resize') {
        return;
      }
      closeBottomPanel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let an open modal consume Escape instead of closing the panel behind it.
        if (document.querySelector('.base-modal-overlay')) return;
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

  // Fetch tab counts when a row is selected
  useEffect(() => {
    if (!selectedRow || !enableTabCounts) {
      setTabCounts({});
      return;
    }

    const hasCountableTabs = safeTabs.some(t => t.countable !== false && t.countKey);
    if (!hasCountableTabs) {
      return;
    }

    if (!tabCountsFetcher && !resourceKind) {
      return;
    }

    const kind = resourceKind || 'Unknown';
    const name = selectedRow.name ?? selectedRow.Name;
    const ns = selectedRow.namespace ?? selectedRow.Namespace;

    let cancelled = false;
    const isInitialLoad = !tabCountsInitializedRef.current;
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
      return fetchTabCounts(kind, String(ns ?? ''), String(name));
    };

    Promise.resolve()
      .then(fetchCounts)
      .then((counts) => {
        if (!cancelled) {
          setTabCounts(counts || {});
          tabCountsInitializedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (isInitialLoad) {
            setTabCounts({});
            tabCountsInitializedRef.current = true;
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

  const getRowKey = (row: Row) => {
    const meta = row.metadata as { uid?: unknown } | undefined;
    const ns = row.namespace || row.Namespace || '';
    const uid = row.uid ?? row.UID ?? meta?.uid ?? null;
    const name = row.id ?? row.name ?? row.Name ?? null;
    if (uid) return String(uid);
    if (name) return ns ? `${String(ns)}/${String(name)}` : String(name);
    return String(JSON.stringify(row));
  };

  const resolvedBulkActions = useMemo(() => {
    if (Array.isArray(bulkActions)) return bulkActions;
    const inferredKind = bulkResourceKind || resourceKind || createKind;
    return getBulkActionsForResource({ platform: createPlatform, kind: inferredKind });
  }, [bulkActions, bulkResourceKind, resourceKind, createKind, createPlatform]);

  const bulkEnabled = resolvedBulkActions.length > 0;

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

  const handleBulkAction = useCallback(async (action: BulkAction, selectedRows: Row[]) => {
    if (!bulkEnabled || !action) return;
    if (selectedRows.length === 0) return;

    if (action.confirm) {
      setBulkActionToDelete({ action, rows: selectedRows });
      setShowDeleteConfirm(true);
      return;
    }

    const options: Record<string, unknown> = {};
    if (action.promptReplicas) {
      setScaleAction({ action, rows: selectedRows });
      setShowScalePrompt(true);
      return;
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
    } catch (err) {
      showError(`${action.label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [bulkEnabled, createPlatform, resourceKind, createKind, bulkResourceKind]);

  const buildRowActions = (row: Row): RowActionType<Row>[] => {
    const api = {
      openDetails: (tabKey?: string) => openBottomPanelAtTab(row, tabKey),
      setActiveTab,
      refresh: onRefreshData,
    };
    const extra = typeof getRowActions === 'function' ? (getRowActions(row, api) || []) : [];
    const normalizedExtra = Array.isArray(extra) ? extra.filter(Boolean) : [];
    // ponytail: map legacy RowAction to DataTable's RowAction<TRow> (onClick required)
    return [
      { label: 'Details', icon: '🔎', onClick: () => openBottomPanel(row) },
      ...normalizedExtra.map((a) => ({
        ...a,
        onClick: a.onClick || (() => {}),
      })),
    ];
  };

  // Adapt column definitions from legacy format to DataTable format
  const adaptedColumns = useMemo(() => adaptColumnsForDataTable(columns), [columns]);

  const persistKey = resourceKind ? `overview-${resourceKind}` : undefined;
  const scrollContainerTestId = tableTestId ? `${tableTestId}-scroll-container` : 'overview-table-scroll-container';

  return (
    <div className="overview-table-with-panel">
      <div className="overview-header">
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
          <div className="column-visibility-menu">
            <button
              type="button"
              title="Column visibility"
              onClick={() => setColumnVisibilityMenuOpen(!columnVisibilityMenuOpen)}
              className="column-visibility-button"
            >
              👁️
            </button>
            {columnVisibilityMenuOpen && (
              <ColumnVisibilityMenu
                columns={adaptedColumns}
                visibility={{}}
                onVisibilityChange={() => {}}
                onClose={() => setColumnVisibilityMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="overview-table-scroll" data-testid={scrollContainerTestId}>
        <DataTable
          columns={adaptedColumns}
          data={data}
          getRowId={getRowKey}
          loading={loading}
          emptyMessage={`No ${title || resourceKind} deployed in this namespace`}
          enableSelection={bulkEnabled}
          bulkActions={resolvedBulkActions}
          onBulkAction={handleBulkAction}
          rowActions={buildRowActions}
          onRowClick={openBottomPanel}
          title={undefined} // title moved to header
          toolbarRight={undefined}
          globalFilterPlaceholder="Filter..."
          enableColumnReorder={true}
          enableColumnVisibility={true}
          initialSorting={[]}
          persistKey={persistKey}
          testId={tableTestId}
        />
      </div>

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
          ? renderPanelContent(selectedRow, activeTab, { activeTab, setActiveTab, tabCounts, refresh: onRefreshData, openDetails: (tabKey?: string) => openBottomPanelAtTab(selectedRow, tabKey) })
          : null}
      </BottomPanel>

      <CreateManifestOverlay
        open={showCreate}
        platform={createPlatform}
        kind={createKind ?? resourceKind}
        namespace={namespace}
        createHint={createHint}
        onClose={() => setShowCreate(false)}
      />

      {/* Delete confirmation modal */}
      <BaseModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setBulkActionToDelete(null);
        }}
        title="Confirm bulk action"
      >
        {bulkActionToDelete && (
          <div className="modal-content">
            <p>
              {bulkActionToDelete.action.label} {bulkActionToDelete.rows.length} selected item(s)?
            </p>
            <div className="modal-footer">
              <ModalButton onClick={() => {
                setShowDeleteConfirm(false);
                setBulkActionToDelete(null);
              }}>
                Cancel
              </ModalButton>
              <ModalDangerButton onClick={async () => {
                if (bulkActionToDelete) {
                  setShowDeleteConfirm(false);
                  setBulkActionToDelete(null);
                  await handleBulkAction(bulkActionToDelete.action, bulkActionToDelete.rows);
                }
              }}>
                Confirm
              </ModalDangerButton>
            </div>
          </div>
        )}
      </BaseModal>

      {/* Scale prompt modal */}
      <BaseModal
        isOpen={showScalePrompt}
        onClose={() => {
          setShowScalePrompt(false);
          setScaleAction(null);
        }}
        title="Scale replica count"
      >
        {scaleAction && (
          <div className="modal-content">
            <ScalePromptForm
              initialReplicas={Number(scaleAction.rows[0]?.replicas ?? scaleAction.rows[0]?.Replicas ?? 0)}
              onCancel={() => {
                setShowScalePrompt(false);
                setScaleAction(null);
              }}
              onScale={async (replicas) => {
                const options: Record<string, unknown> = { replicas };
                try {
                  const summary = await executeBulkAction({
                    platform: createPlatform,
                    kind: scaleAction.action.key === 'scale' ? (bulkResourceKind || resourceKind || createKind) : createKind,
                    actionKey: scaleAction.action.key,
                    rows: scaleAction.rows,
                    options,
                  });
                  if (summary.failed === 0) {
                    showSuccess(`${scaleAction.action.label} succeeded for ${summary.succeeded} item(s).`);
                  } else {
                    showError(`${scaleAction.action.label} completed with ${summary.failed} failure(s).`);
                  }
                } catch (err) {
                  showError(`${scaleAction.action.label} failed: ${err instanceof Error ? err.message : String(err)}`);
                } finally {
                  setShowScalePrompt(false);
                  setScaleAction(null);
                }
              }}
            />
          </div>
        )}
      </BaseModal>
    </div>
  );
}

function ScalePromptForm({
  initialReplicas,
  onCancel,
  onScale,
}: {
  initialReplicas: number;
  onCancel: () => void;
  onScale: (replicas: number) => Promise<void>;
}) {
  const [replicas, setReplicas] = useState(String(initialReplicas));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(replicas);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Replica count must be a non-negative number.');
      return;
    }
    setError(null);
    await onScale(Math.floor(parsed));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="replica-count">Enter desired replica count:</label>
        <input
          id="replica-count"
          type="number"
          min="0"
          value={replicas}
          onChange={(e) => setReplicas(e.target.value)}
          autoFocus
        />
        {error && <p className="error-message" style={{ color: 'var(--gh-error, #f85149)' }}>{error}</p>}
      </div>
      <div className="modal-footer">
        <ModalButton onClick={onCancel}>Cancel</ModalButton>
        <ModalPrimaryButton type="submit">Scale</ModalPrimaryButton>
      </div>
    </form>
  );
}
