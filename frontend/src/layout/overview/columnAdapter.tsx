import { ReactNode } from 'react';
import StatusBadge from '../../components/StatusBadge';
import type { DataTableColumn } from '../../components/DataTable';

type CellContext = {
  getValue: () => unknown;
  row?: { original: Record<string, unknown> };
};

type ColumnDef = {
  key?: string;
  label?: string;
  header?: string;
  accessorKey?: string;
  width?: string | number;
  cell?: (_ctx: CellContext) => ReactNode;
};

const STATUS_BADGE_KEYS = new Set(['status', 'state', 'availability', 'phase']);

/**
 * Adapter: convert legacy column format to DataTableColumn format.
 *
 * Config cells are TanStack-style — they receive a context `{ getValue, row }`.
 * DataTable calls a column's `cell` with the RAW row (see DataTable.tsx). So we
 * wrap each config cell to build the context it expects; passing it through
 * unwrapped makes `ctx.getValue()` throw at runtime ("e.getValue is not a function").
 *
 * Also auto-renders StatusBadge for common status keys that have no cell.
 */
export function adaptColumnsForDataTable(
  columns: ColumnDef[]
): DataTableColumn<Record<string, unknown>>[] {
  return columns.map((col) => {
    const id = col.accessorKey || col.key || '';
    const header = col.header || col.label || '';
    const isStatusLike = STATUS_BADGE_KEYS.has(String(id).toLowerCase());

    const configCell = col.cell;
    const cell: DataTableColumn<Record<string, unknown>>['cell'] = configCell
      ? (row) => configCell({ getValue: () => row[id], row: { original: row } })
      : isStatusLike
        ? (row) => {
            const value = row[id];
            if (value === null || value === undefined || value === '') return '-';
            return <StatusBadge status={String(value)} size="small" />;
          }
        : undefined;

    return {
      id,
      header,
      accessorKey: col.accessorKey || col.key,
      width: col.width,
      cell,
    } as DataTableColumn<Record<string, unknown>>;
  });
}
