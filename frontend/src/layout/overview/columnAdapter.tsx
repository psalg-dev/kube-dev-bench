import { ReactNode } from 'react';
import StatusBadge from '../../components/StatusBadge';
import type { DataTableColumn } from '../../components/DataTable';

type ColumnDef = {
  key?: string;
  label?: string;
  header?: string;
  accessorKey?: string;
  width?: string | number;
  cell?: (_ctx: { getValue: () => unknown }) => ReactNode;
};

const STATUS_BADGE_KEYS = new Set(['status', 'state', 'availability', 'phase']);

/**
 * Adapter: convert legacy column format to DataTableColumn format.
 * Handles status badge auto-rendering for common status keys.
 */
export function adaptColumnsForDataTable(
  columns: ColumnDef[]
): DataTableColumn<Record<string, unknown>>[] {
  return columns.map((col) => {
    const id = col.accessorKey || col.key || '';
    const header = col.header || col.label || '';
    const isStatusLike = STATUS_BADGE_KEYS.has(String(id).toLowerCase());

    return {
      id,
      header,
      accessorKey: col.accessorKey || col.key,
      width: col.width,
      cell: col.cell
        ? col.cell
        : isStatusLike
          ? (row) => {
              const value = row[id];
              if (value === null || value === undefined || value === '') return '-';
              return <StatusBadge status={String(value)} size="small" />;
            }
          : undefined,
    } as DataTableColumn<Record<string, unknown>>;
  });
}
