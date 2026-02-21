import type { ReactNode } from 'react';

export interface BaseTableColumn<TData = unknown> {
  id?: string;
  header?: string | ((_props: { column: unknown }) => ReactNode);
  accessorKey?: string;
  accessorFn?: (_row: TData) => unknown;
  cell?: (_props: { row: unknown; getValue: () => unknown }) => ReactNode;
  enableSorting?: boolean;
  size?: number;
  meta?: Record<string, unknown>;
}
export interface TabDefinition {
  id: string;
  label: string;
  render: () => ReactNode;
  badgeCount?: number;
}
