import { describe, it, expect } from 'vitest';
import { adaptColumnsForDataTable } from '../layout/overview/columnAdapter';

describe('columnAdapter', () => {
  it('transforms basic column with key and label to DataTableColumn', () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
    ];

    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted).toHaveLength(2);
    expect(adapted[0].id).toBe('name');
    expect(adapted[0].header).toBe('Name');
    expect(adapted[0].accessorKey).toBe('name');
    expect(adapted[1].id).toBe('status');
    expect(adapted[1].header).toBe('Status');
    expect(adapted[1].accessorKey).toBe('status');
    expect(adapted[1].cell).toBeDefined(); // status should auto-render StatusBadge
  });

  it('uses accessorKey if provided instead of key', () => {
    const columns = [{ key: 'name', accessorKey: 'resourceName', label: 'Name' }];

    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted[0].accessorKey).toBe('resourceName');
    expect(adapted[0].id).toBe('resourceName');
  });

  it('uses header if provided over label', () => {
    const columns = [{ key: 'status', header: 'Current Status', label: 'Status' }];

    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted[0].header).toBe('Current Status');
  });

  it('preserves width property', () => {
    const columns = [{ key: 'name', label: 'Name', width: '150px' }];

    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted[0].width).toBe('150px');
  });

  it('wraps config cell so it receives a { getValue, row } context from a raw row', () => {
    // DataTable calls column.cell(rawRow); the config cell reads ctx.getValue() and
    // ctx.row.original. Regression guard: passing the config cell through unwrapped
    // made ctx.getValue() throw "e.getValue is not a function" at runtime.
    const seen: { value: unknown; original: unknown } = { value: undefined, original: undefined };
    const cellFn = (ctx: { getValue: () => unknown; row?: { original: unknown } }) => {
      seen.value = ctx.getValue();
      seen.original = ctx.row?.original;
      return `v=${String(ctx.getValue())}`;
    };
    const columns = [{ key: 'name', label: 'Name', cell: cellFn }];

    const adapted = adaptColumnsForDataTable(columns);
    const row = { name: 'nginx', namespace: 'default' };
    const rendered = (adapted[0].cell as (r: Record<string, unknown>) => unknown)(row);

    expect(rendered).toBe('v=nginx');
    expect(seen.value).toBe('nginx');
    expect(seen.original).toBe(row);
  });

  it('adds StatusBadge cell for status-like keys without cell function', () => {
    const columns = [{ key: 'status', label: 'Status' }];

    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted[0].cell).toBeDefined();
    // Cell should render StatusBadge for status values
  });

  it('does not override custom cell function for status columns', () => {
    // status-like key but a custom cell is provided -> custom cell wins (wrapped), no StatusBadge
    const customCell = (ctx: { getValue: () => unknown }) => `custom:${String(ctx.getValue())}`;
    const columns = [{ key: 'status', label: 'Status', cell: customCell }];

    const adapted = adaptColumnsForDataTable(columns);
    const rendered = (adapted[0].cell as (r: Record<string, unknown>) => unknown)({ status: 'Running' });

    expect(rendered).toBe('custom:Running');
  });

  it('handles state, availability, phase as status-like columns', () => {
    const columns = [
      { key: 'state', label: 'State' },
      { key: 'availability', label: 'Availability' },
      { key: 'phase', label: 'Phase' },
    ];

    const adapted = adaptColumnsForDataTable(columns);

    adapted.forEach((col) => {
      expect(col.cell).toBeDefined();
    });
  });

  it('case-insensitive status detection', () => {
    const columns = [
      { key: 'STATUS', label: 'Status' },
      { key: 'State', label: 'State' },
    ];

    const adapted = adaptColumnsForDataTable(columns);

    adapted.forEach((col) => {
      expect(col.cell).toBeDefined();
    });
  });

  it('cell function handles null, undefined, and empty string values', () => {
    const columns = [{ key: 'status', label: 'Status' }];
    const adapted = adaptColumnsForDataTable(columns);

    const cellFn = adapted[0].cell as (row: any) => any;

    expect(cellFn({ status: null })).toBe('-');
    expect(cellFn({ status: undefined })).toBe('-');
    expect(cellFn({ status: '' })).toBe('-');
  });

  it('cell function renders StatusBadge for non-empty status values', () => {
    const columns = [{ key: 'status', label: 'Status' }];
    const adapted = adaptColumnsForDataTable(columns);

    const cellFn = adapted[0].cell as (row: any) => any;
    const result = cellFn({ status: 'Running' });

    expect(result).toBeDefined();
    // Check if it's a React element
    expect(result.type).toBeDefined();
  });

  it('handles columns without key and label', () => {
    const columns = [{ header: 'Count' }];
    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted[0].id).toBe('');
    expect(adapted[0].header).toBe('Count');
  });

  it('preserves custom width values including numbers', () => {
    const columns = [
      { key: 'name', label: 'Name', width: 100 },
      { key: 'status', label: 'Status', width: '200px' },
    ];

    const adapted = adaptColumnsForDataTable(columns);

    expect(adapted[0].width).toBe(100);
    expect(adapted[1].width).toBe('200px');
  });
});
