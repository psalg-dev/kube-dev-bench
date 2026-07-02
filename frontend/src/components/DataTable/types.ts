import type { SortingState } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { BulkAction } from '../../constants/bulkActions';

export interface RowAction<TRow> {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: (row: TRow) => void | Promise<void>;
}

export type ColumnAlign = 'left' | 'center' | 'right';

export type { ColumnSortType } from './sortingFns';

import type { ColumnSortType } from './sortingFns';

export interface DataTableColumn<TRow> {
  id: string;
  header: string;
  accessorKey?: Extract<keyof TRow, string>;
  cell?: (row: TRow) => ReactNode;
  width?: number | string;
  align?: ColumnAlign;
  sortType?: ColumnSortType;
  enableSorting?: boolean;
  enableHiding?: boolean;
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  getRowId: (row: TRow) => string;
  loading?: boolean;
  emptyMessage?: ReactNode;
  enableSelection?: boolean;
  bulkActions?: BulkAction[];
  onBulkAction?: (action: BulkAction, rows: TRow[]) => void | Promise<void>;
  rowActions?: (row: TRow) => RowAction<TRow>[];
  onRowClick?: (row: TRow) => void;
  isRowActive?: (row: TRow) => boolean;
  title?: ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  globalFilterPlaceholder?: string;
  enableColumnReorder?: boolean;
  enableColumnVisibility?: boolean;
  initialSorting?: SortingState;
  persistKey?: string;
  testId?: string;
}
