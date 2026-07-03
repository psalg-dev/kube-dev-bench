import './DataTable.css';
import { useState, useMemo, useCallback, type ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
  type SortingFn,
} from '@tanstack/react-table';
import type { DataTableProps, ColumnAlign } from './types';

// Per-column layout hints stashed on TanStack's column meta.
interface DataTableColumnMeta {
  align?: ColumnAlign;
  width?: number | string;
}
import { sortTypeToFn } from './sortingFns';
import { usePersistedTableState } from './usePersistedTableState';
import { useRangeSelection } from './useRangeSelection';
import { ColumnHeader } from './ColumnHeader';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { RowActionsMenu } from './RowActionsMenu';
import BulkActionBar from '../BulkActionBar';

export function DataTable<TRow extends Record<string, unknown>>({
  columns,
  data,
  getRowId,
  loading = false,
  emptyMessage = 'No data available',
  enableSelection = false,
  bulkActions = [],
  onBulkAction,
  rowActions,
  onRowClick,
  isRowActive,
  title,
  toolbarLeft,
  toolbarRight,
  globalFilterPlaceholder = 'Search...',
  enableColumnReorder = false,
  enableColumnVisibility = false,
  initialSorting = [],
  persistKey,
  testId,
}: DataTableProps<TRow>) {
  // State management
  const { columnOrder, setColumnOrder, columnVisibility, setColumnVisibility, sorting, setSorting } =
    usePersistedTableState(persistKey);

  const { setAnchor, rangeTo } = useRangeSelection();
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<{ key: string; anchor: HTMLElement } | null>(null);

  // Initialize sorting from persistKey or initialSorting
  const initialSort = useMemo(() => {
    if (sorting && sorting.length > 0) return sorting;
    return initialSorting;
  }, [sorting, initialSorting]);

  // Build column definitions
  const columnHelper = createColumnHelper<TRow>();

  const columnDefs = useMemo<ColumnDef<TRow>[]>(() => {
    const defs: ColumnDef<TRow>[] = [];

    // Selection column
    if (enableSelection) {
      defs.push(
        columnHelper.display({
          id: '_select',
          header: ({ table }) => (
            <input
              type="checkbox"
              checked={table.getIsAllRowsSelected()}
              onChange={(e) => table.toggleAllRowsSelected(e.target.checked)}
              aria-label="Select all"
            />
          ),
          cell: ({ row }) => {
            const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
              if (e.shiftKey) {
                const sortedIds = table.getSortedRowModel().rows.map((r) => r.id);
                const range = rangeTo(sortedIds, row.id);
                const newSelection: Record<string, boolean> = {};
                range.forEach((id) => {
                  newSelection[id] = true;
                });
                setRowSelection((prev) => ({ ...prev, ...newSelection }));
                setAnchor(row.id);
                // Don't toggle the checkbox directly
                e.preventDefault();
              } else {
                setAnchor(row.id);
              }
            };

            return (
              <input
                type="checkbox"
                value={row.id}
                checked={row.getIsSelected()}
                onChange={(e) => row.toggleSelected(e.target.checked)}
                onClick={handleCheckboxClick}
                aria-label={`Select row ${row.id}`}
              />
            );
          },
          enableSorting: false,
          enableHiding: false,
        })
      );
    }

    // Data columns
    columns.forEach((col) => {
      // accessor's return union widens for wide TRow (e.g. Record<string,unknown>), so the
      // AccessorFnColumnDef won't narrow to ColumnDef<TRow>; annotate to bridge the generic.
      const accessorKey = (col.accessorKey ?? col.id) as keyof TRow;
      const def: ColumnDef<TRow> = columnHelper.accessor(
        // Accessor returns the raw VALUE (drives sorting + global filter). Rendering, which
        // may return JSX, goes through `cell` — putting JSX in the accessor makes TanStack
        // stringify it to "[object Object]" and sorts/filters on the element, not the value.
        (row) => (accessorKey in (row as object) ? row[accessorKey] : ''),
        {
          id: col.id,
          header: col.header,
          cell: col.cell
            ? (ctx) => col.cell!(ctx.row.original)
            : (ctx) => {
                const v = ctx.getValue();
                return (v === null || v === undefined ? '' : v) as ReactNode;
              },
          enableSorting: col.enableSorting !== false,
          // sortTypeToFn is SortingFn<unknown>; TanStack wants SortingFn<TRow> (compatible, generic bridge).
          sortingFn: (col.sortType
            ? sortTypeToFn(col.sortType)
            : sortTypeToFn('text')) as SortingFn<TRow>,
          enableHiding: col.enableHiding !== false,
          meta: {
            align: col.align,
            width: col.width,
          } satisfies DataTableColumnMeta,
        }
      ) as ColumnDef<TRow>;
      defs.push(def);
    });

    // Row actions column
    if (rowActions) {
      defs.push(
        columnHelper.display({
          id: '_actions',
          header: '',
          cell: ({ row }) => {
            const actions = rowActions(row.original);
            const rowKey = row.id;
            return (
              <div className="row-actions-cell">
                <button
                  type="button"
                  className="row-actions-button"
                  aria-label="Row actions"
                  title="Actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    const anchor = e.currentTarget;
                    setOpenMenu((cur) => (cur?.key === rowKey ? null : { key: rowKey, anchor }));
                  }}
                >
                  ···
                </button>
                {openMenu?.key === rowKey && (
                  <RowActionsMenu
                    row={row.original}
                    actions={actions}
                    anchorEl={openMenu.anchor}
                    onClose={() => setOpenMenu(null)}
                  />
                )}
              </div>
            );
          },
          enableSorting: false,
          enableHiding: false,
        })
      );
    }

    return defs;
  }, [columns, columnHelper, enableSelection, rowActions, openMenu, rangeTo]);

  // Create table instance
  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: initialSort,
      globalFilter,
      rowSelection,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getRowId,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const searchStr = filterValue.toLowerCase();
      for (const cell of row.getAllCells()) {
        const value = String(cell.getValue() || '').toLowerCase();
        if (value.includes(searchStr)) {
          return true;
        }
      }
      return false;
    },
  });

  // Handle bulk actions
  const handleBulkAction = useCallback(
    async (action: typeof bulkActions[number]) => {
      const selectedRows = table
        .getSelectedRowModel()
        .rows.map((row) => row.original);
      await onBulkAction?.(action, selectedRows);
      table.resetRowSelection();
    },
    [table, onBulkAction]
  );

  // Handle column reorder
  const handleColumnReorder = useCallback(
    (fromId: string, toId: string) => {
      // columnOrder starts empty; fall back to actual leaf order so the first drag works.
      const currentOrder =
        columnOrder.length > 0 ? columnOrder : table.getAllLeafColumns().map((c) => c.id);
      const fromIdx = currentOrder.indexOf(fromId);
      const toIdx = currentOrder.indexOf(toId);

      if (fromIdx === -1 || toIdx === -1) return;

      const newOrder = [...currentOrder];
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, fromId);
      setColumnOrder(newOrder);
    },
    [columnOrder, setColumnOrder, table]
  );

  // Handle column visibility
  const handleVisibilityChange = useCallback(
    (columnId: string, visible: boolean) => {
      setColumnVisibility((prev) => ({
        ...prev,
        [columnId]: visible,
      }));
    },
    [setColumnVisibility]
  );

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  if (loading) {
    return (
      <div className="data-table-container" data-testid={testId}>
        <div className="data-table-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="data-table-container" data-testid={testId}>
      {(title || toolbarLeft || toolbarRight || globalFilterPlaceholder) && (
        <div className="data-table-toolbar">
          <div className="data-table-toolbar-left">
            {title && <div className="data-table-title">{title}</div>}
            {toolbarLeft}
          </div>
          <div className="data-table-toolbar-right">
            {globalFilterPlaceholder && (
              <div className="data-table-filter">
                <input
                  type="search"
                  placeholder={globalFilterPlaceholder}
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  aria-label="Filter table"
                />
              </div>
            )}
            {enableColumnVisibility && (
              <div className="column-visibility-menu">
                <button
                  type="button"
                  title="Column visibility"
                  onClick={() => setVisibilityMenuOpen(!visibilityMenuOpen)}
                  className="column-visibility-button"
                >
                  👁️
                </button>
                {visibilityMenuOpen && (
                  <ColumnVisibilityMenu
                    columns={columns}
                    visibility={columnVisibility}
                    onVisibilityChange={handleVisibilityChange}
                    onClose={() => setVisibilityMenuOpen(false)}
                  />
                )}
              </div>
            )}
            {toolbarRight}
          </div>
        </div>
      )}

      {selectedCount > 0 && enableSelection && (
        <BulkActionBar
          selectedCount={selectedCount}
          actions={bulkActions}
          onAction={handleBulkAction}
          onClear={() => table.resetRowSelection()}
        />
      )}

      <div className="data-table-wrapper">
        <table className="data-table gh-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <ColumnHeader
                    key={header.id}
                    header={header}
                    sortable={header.column.columnDef.enableSorting !== false}
                    enableReorder={enableColumnReorder && header.id !== '_select' && header.id !== '_actions'}
                    onReorder={handleColumnReorder}
                    onSort={() => header.column.toggleSorting()}
                  />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={isRowActive?.(row.original) ? 'active' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={
                          cell.column.id === '_select'
                            ? 'checkbox-cell'
                            : cell.column.id === '_actions'
                              ? 'row-actions-cell'
                              : ''
                        }
                        style={{
                          textAlign: meta?.align || 'left',
                          width: meta?.width,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columnDefs.length} className="data-table-empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
