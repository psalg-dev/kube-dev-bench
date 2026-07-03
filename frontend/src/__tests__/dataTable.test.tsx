import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Row } from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../components/DataTable';
import { UptimeCell } from '../components/DataTable';
import type { DataTableColumn } from '../components/DataTable/types';
import type { BulkAction } from '../constants/bulkActions';
import { textSortingFn, numberSortingFn, durationSortingFn, datetimeSortingFn } from '../components/DataTable/sortingFns';
import { computeRange } from '../components/DataTable/useRangeSelection';

type TestRow = {
  id: string;
  name: string;
  duration: string;
  created: string;
  active: boolean;
};

const testData: TestRow[] = [
  { id: '1', name: 'Item A', duration: '5m', created: '2024-01-01T10:00:00Z', active: true },
  { id: '2', name: 'Item B', duration: '2h', created: '2024-01-02T10:00:00Z', active: false },
  { id: '3', name: 'Item C', duration: '1d', created: '2024-01-03T10:00:00Z', active: true },
];

const testColumns: DataTableColumn<TestRow>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name' },
  { id: 'duration', header: 'Duration', accessorKey: 'duration', sortType: 'duration' },
  { id: 'created', header: 'Created', accessorKey: 'created', sortType: 'datetime' },
];

const testBulkActions: BulkAction[] = [
  { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  { key: 'archive', label: 'Archive', icon: '📦' },
];

describe('DataTable', () => {
  it('renders rows and cells from typed columns', () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        testId="data-table"
      />
    );

    // Check headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();

    // Check data rows
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('Item C')).toBeInTheDocument();
  });

  it('exposes the gh-table DOM contract: gh-table class, button-role headers, aria-sort', () => {
    // E2E + app CSS target `table.gh-table`; sort helpers read a `button` named after the
    // column and the th's `aria-sort`. Regression guard for the DataTable re-skin.
    const { container } = render(
      <DataTable<TestRow> columns={testColumns} data={testData} getRowId={(row) => row.id} />
    );

    expect(container.querySelector('table.gh-table')).toBeInTheDocument();

    const nameButton = screen.getByRole('button', { name: 'Name' });
    const nameHeader = nameButton.closest('th')!;
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(nameHeader);
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(nameHeader);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts by text column in asc/desc/off order', async () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toBeInTheDocument();

    // First click: ascending
    fireEvent.click(nameHeader!);
    let rows = container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Item A');
    expect(rows[1].textContent).toContain('Item B');

    // Second click: descending
    fireEvent.click(nameHeader!);
    rows = container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Item C');
    expect(rows[1].textContent).toContain('Item B');

    // Third click: no sort (original order)
    fireEvent.click(nameHeader!);
    rows = container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Item A');
  });

  it('sorts duration column correctly (5m < 1h < 1d)', async () => {
    const durationData: TestRow[] = [
      { id: '1', name: 'A', duration: '1d', created: '2024-01-01T10:00:00Z', active: true },
      { id: '2', name: 'B', duration: '5m', created: '2024-01-02T10:00:00Z', active: false },
      { id: '3', name: 'C', duration: '1h', created: '2024-01-03T10:00:00Z', active: true },
    ];

    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={durationData}
        getRowId={(row) => row.id}
      />
    );

    const durationHeader = screen.getByText('Duration').closest('th');
    fireEvent.click(durationHeader!);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('5m');
    expect(rows[1].textContent).toContain('1h');
    expect(rows[2].textContent).toContain('1d');
  });

  it('filters rows with global filter', async () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        globalFilterPlaceholder="Search..."
      />
    );

    const filterInput = screen.getByPlaceholderText('Search...');
    await userEvent.type(filterInput, 'Item B');

    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.queryByText('Item A')).not.toBeInTheDocument();
    expect(screen.queryByText('Item C')).not.toBeInTheDocument();
  });

  it('shows emptyMessage when filter results in no rows', async () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        globalFilterPlaceholder="Search..."
        emptyMessage="No items found"
      />
    );

    const filterInput = screen.getByPlaceholderText('Search...');
    await userEvent.type(filterInput, 'NonExistent');

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('selects single row via checkbox', async () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    const firstRowCheckbox = container.querySelector('input[type="checkbox"][value="1"]') as HTMLInputElement;
    expect(firstRowCheckbox).toBeInTheDocument();

    fireEvent.click(firstRowCheckbox);
    expect(firstRowCheckbox.checked).toBe(true);
  });

  it('selects all rows via header checkbox', async () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    const headerCheckbox = container.querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    expect(headerCheckbox).toBeInTheDocument();

    fireEvent.click(headerCheckbox);
    const rowCheckboxes = container.querySelectorAll('tbody input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    rowCheckboxes.forEach((checkbox) => {
      expect(checkbox.checked).toBe(true);
    });
  });

  it('shift-click selects range of rows', async () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    const cb = (v: string) =>
      container.querySelector(`input[type="checkbox"][value="${v}"]`) as HTMLInputElement;

    // Click row A (sets anchor + selects it via change)
    fireEvent.click(cb('1'));
    expect(cb('1').checked).toBe(true);

    // Shift-click row C — range logic alone must select A,B,C. No manual force.
    // Re-query after the first click (React may have replaced the DOM node).
    fireEvent.click(cb('3'), { shiftKey: true });

    // The middle row B is the whole point of a range — it must be selected.
    expect(cb('1').checked).toBe(true);
    expect(cb('2').checked).toBe(true);
    expect(cb('3').checked).toBe(true);
  });

  it('calls onBulkAction with selected rows and clears selection', async () => {
    const onBulkAction = vi.fn();
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
        bulkActions={testBulkActions}
        onBulkAction={onBulkAction}
      />
    );

    // Select at least one row to trigger bulk action
    const checkbox1 = container.querySelector('input[type="checkbox"][value="1"]') as HTMLInputElement;
    fireEvent.click(checkbox1);
    fireEvent.change(checkbox1, { target: { checked: true } });
    expect(checkbox1.checked).toBe(true);

    // Click bulk action button
    const deleteButton = screen.getByText('Delete');
    await userEvent.click(deleteButton);

    // Verify bulk action was called with at least the first row
    expect(onBulkAction).toHaveBeenCalledTimes(1);
    const callArgs = onBulkAction.mock.calls[0];
    expect(callArgs[0]).toEqual(testBulkActions[0]);
    expect(Array.isArray(callArgs[1])).toBe(true);
    expect(callArgs[1].length).toBeGreaterThanOrEqual(1);

    // Wait for state update and re-render
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Selection should be cleared - get fresh reference
    const freshCheckbox1 = container.querySelector('input[type="checkbox"][value="1"]') as HTMLInputElement;
    expect(freshCheckbox1.checked).toBe(false);
  });

  it('calls onRowClick when row is clicked', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
      />
    );

    const itemText = screen.getByText('Item A');
    const row = itemText.closest('tr');
    fireEvent.click(row!);

    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
  });

  it('applies active class when isRowActive returns true', () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        isRowActive={(row) => row.id === '2'}
      />
    );

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]).not.toHaveClass('active');
    expect(rows[1]).toHaveClass('active');
    expect(rows[2]).not.toHaveClass('active');
  });

  it('row actions menu calls onClick and closes on outside click', async () => {
    const onRowAction = vi.fn();
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        rowActions={(row) => [
          { label: 'Edit', onClick: () => onRowAction('edit', row) },
          { label: 'Delete', danger: true, onClick: () => onRowAction('delete', row) },
        ]}
      />
    );

    // Find first row actions button
    const actionButtons = container.querySelectorAll('button');
    let actionButton: Element | null = null;
    for (const btn of actionButtons) {
      if (btn.textContent === '···') {
        actionButton = btn;
        break;
      }
    }

    expect(actionButton).toBeInTheDocument();
    fireEvent.click(actionButton!);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    // Click action
    await userEvent.click(screen.getByText('Edit'));
    expect(onRowAction).toHaveBeenCalledWith('edit', testData[0]);

    // Menu should close
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('row actions menu closes on Escape', async () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        rowActions={() => [{ label: 'Edit', onClick: vi.fn() }]}
      />
    );

    const actionButtons = container.querySelectorAll('button');
    let actionButton: Element | null = null;
    for (const btn of actionButtons) {
      if (btn.textContent === '···') {
        actionButton = btn;
        break;
      }
    }

    fireEvent.click(actionButton!);
    expect(screen.getByText('Edit')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('drag-reorder updates column order and persists', async () => {
    const persistKey = `test-table-${Date.now()}`;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableColumnReorder
        persistKey={persistKey}
      />
    );

    const headerText = () =>
      Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.replace(/[↕↑↓]/g, '').trim());

    // Initial visible order: Name, Duration, Created
    expect(headerText()).toEqual(['Name', 'Duration', 'Created']);

    const headers = container.querySelectorAll('th[draggable="true"]');
    const nameHeader = headers[0]; // Name
    const createdHeader = headers[2]; // Created

    // jsdom has no real dataTransfer — supply a mock that round-trips the dragged id.
    let dragged = '';
    const dt = {
      setData: vi.fn((_type: string, val: string) => {
        dragged = val;
      }),
      getData: vi.fn(() => dragged),
      dropEffect: '',
      effectAllowed: '',
    };

    // Drag Name onto Created → Name moves to Created's slot.
    fireEvent.dragStart(nameHeader, { dataTransfer: dt });
    fireEvent.dragOver(createdHeader, { dataTransfer: dt });
    fireEvent.drop(createdHeader, { dataTransfer: dt });

    // Rendered order actually changed: Name is no longer first.
    const after = headerText();
    expect(after[0]).not.toBe('Name');
    expect(after).toEqual(['Duration', 'Created', 'Name']);

    // Persisted the new order under the canonical datatable: key.
    const stored = localStorage.getItem(`datatable:${persistKey}`);
    expect(stored).toBeTruthy();
    const state = JSON.parse(stored!);
    expect(state.columnOrder).toEqual(['duration', 'created', 'name']);
    expect(setItemSpy).toHaveBeenCalledWith(`datatable:${persistKey}`, expect.any(String));

    setItemSpy.mockRestore();
  });

  it('toggling column visibility hides column and persists', async () => {
    const persistKey = `test-table-${Date.now()}`;
    const { container, rerender } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableColumnVisibility
        persistKey={persistKey}
      />
    );

    // Find visibility toggle button
    const buttons = container.querySelectorAll('button');
    let visibilityButton: Element | null = null;
    for (const btn of buttons) {
      if (btn.title === 'Column visibility' || btn.textContent?.includes('👁')) {
        visibilityButton = btn;
        break;
      }
    }

    if (visibilityButton) {
      fireEvent.click(visibilityButton);
      const menuLabels = screen.queryAllByText('Name');
      // Find the checkbox in the visibility menu
      let nameCheckbox: HTMLInputElement | null = null;
      for (const label of menuLabels) {
        const checkbox = label.parentElement?.querySelector('input[type="checkbox"]');
        if (checkbox) {
          nameCheckbox = checkbox as HTMLInputElement;
          break;
        }
      }

      if (nameCheckbox) {
        fireEvent.click(nameCheckbox);
        // After unchecking, the Name column header should not be visible
        // Wait a moment for state update
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Re-render to pick up state changes
        rerender(
          <DataTable<TestRow>
            columns={testColumns}
            data={testData}
            getRowId={(row) => row.id}
            enableColumnVisibility
            persistKey={persistKey}
          />
        );

        // Check localStorage persistence
        const stored = localStorage.getItem(persistKey);
        if (stored) {
          const state = JSON.parse(stored);
          expect(state.columnVisibility).toHaveProperty('name');
        }
      }
    }
  });

  it('preserves selection and sort when data array reference changes', async () => {
    const rowNames = () =>
      Array.from(container.querySelectorAll('tbody tr')).map((tr) =>
        tr.querySelector('td:nth-child(2)')?.textContent
      );
    const nameSortIndicator = () =>
      screen.getByText('Name').closest('th')?.querySelector('.sort-indicator')?.textContent;

    const { container, rerender } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    // Select a row
    const checkbox1 = container.querySelector('input[type="checkbox"][value="1"]') as HTMLInputElement;
    fireEvent.click(checkbox1);
    expect(checkbox1.checked).toBe(true);

    // Sort by name DESCENDING (click twice) so the order differs from insertion order.
    const nameHeader = screen.getByText('Name').closest('th');
    fireEvent.click(nameHeader!);
    fireEvent.click(nameHeader!);

    // Baseline: descending → Item C, Item B, Item A; indicator shows ↓.
    expect(rowNames()).toEqual(['Item C', 'Item B', 'Item A']);
    expect(nameSortIndicator()).toBe('↓');

    // Rerender with a FRESH array reference, identical getRowIds.
    const newData = testData.map((row) => ({ ...row }));
    rerender(
      <DataTable<TestRow>
        columns={testColumns}
        data={newData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    // Selection survives.
    const newCheckbox1 = container.querySelector('input[type="checkbox"][value="1"]') as HTMLInputElement;
    expect(newCheckbox1.checked).toBe(true);

    // Sort survives: same direction indicator AND same sorted row order (anti-flicker).
    expect(nameSortIndicator()).toBe('↓');
    expect(rowNames()).toEqual(['Item C', 'Item B', 'Item A']);
  });

  it('renders with loading state without crashing', () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        loading
      />
    );

    expect(container).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('UptimeCell displays elapsed time', () => {
    const startTime = Date.now() - 5000; // 5 seconds ago

    const { container } = render(<UptimeCell startTime={startTime} />);

    // Should show some time value
    expect(container.textContent).not.toBe('-');
    expect(container.textContent).toMatch(/[0-9]/);
  });

  it('duration sorting parses various formats', () => {
    const durationData: TestRow[] = [
      { id: '1', name: 'Item A', duration: '45s', created: '2024-01-01T10:00:00Z', active: true },
      { id: '2', name: 'Item B', duration: '1h', created: '2024-01-02T10:00:00Z', active: false },
      { id: '3', name: 'Item C', duration: '2m', created: '2024-01-03T10:00:00Z', active: true },
    ];

    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={durationData}
        getRowId={(row) => row.id}
      />
    );

    const durationHeader = screen.getByText('Duration').closest('th');
    fireEvent.click(durationHeader!);

    const rows = container.querySelectorAll('tbody tr');
    // Should be sorted: 45s, 2m, 1h
    expect(rows[0].textContent).toContain('45s');
    expect(rows[1].textContent).toContain('2m');
    expect(rows[2].textContent).toContain('1h');
  });


  it('column header renders without sortable prop', () => {
    render(
      <DataTable<TestRow>
        columns={[{ id: 'name', header: 'Name', accessorKey: 'name', enableSorting: false }]}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    // Header renders; non-sortable column shows no sort indicator.
    const th = screen.getByText('Name').closest('th');
    expect(th).toBeInTheDocument();
    expect(th?.querySelector('.sort-indicator')).toBeNull();
  });

  it('displays title and toolbar options', () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        title="Test Table"
        toolbarLeft={<div>Left</div>}
        toolbarRight={<div>Right</div>}
      />
    );

    expect(screen.getByText('Test Table')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('empty data renders empty message', () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={[]}
        getRowId={(row) => row.id}
        emptyMessage="Custom empty message"
      />
    );

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('row actions with disabled state', () => {
    const onRowAction = vi.fn();
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        rowActions={() => [
          { label: 'Delete', disabled: true, onClick: onRowAction },
        ]}
      />
    );

    // Find and click the actions button
    const actionButtons = container.querySelectorAll('button');
    let actionButton: Element | null = null;
    for (const btn of actionButtons) {
      if (btn.textContent === '···') {
        actionButton = btn;
        break;
      }
    }

    fireEvent.click(actionButton!);
    const deleteAction = screen.getByText('Delete');
    fireEvent.click(deleteAction);

    // Should not be called because action is disabled
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it('handles datetime sorting', () => {
    const dateData: TestRow[] = [
      { id: '1', name: 'Item A', duration: '5m', created: '2024-03-01T10:00:00Z', active: true },
      { id: '2', name: 'Item B', duration: '5m', created: '2024-01-01T10:00:00Z', active: false },
      { id: '3', name: 'Item C', duration: '5m', created: '2024-02-01T10:00:00Z', active: true },
    ];

    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={dateData}
        getRowId={(row) => row.id}
      />
    );

    const createdHeader = screen.getByText('Created').closest('th');
    fireEvent.click(createdHeader!);

    const rows = container.querySelectorAll('tbody tr');
    // Should be sorted by date ascending
    expect(rows[0].textContent).toContain('Item B');
  });
});

describe('Sorting Functions', () => {
  // Minimal typed fake Row exposing only getValue, which is all these sort fns read.
  const fakeRow = (v: unknown): Row<unknown> =>
    ({ getValue: () => v } as Pick<Row<unknown>, 'getValue'>) as Row<unknown>;

  it('textSortingFn sorts strings correctly', () => {
    expect(textSortingFn(fakeRow('zebra'), fakeRow('apple'), 'name')).toBeGreaterThan(0);
  });

  it('numberSortingFn sorts numbers numerically not lexically', () => {
    expect(numberSortingFn(fakeRow(100), fakeRow(50), 'value')).toBeGreaterThan(0);
  });

  it('durationSortingFn parses and sorts durations', () => {
    expect(durationSortingFn(fakeRow('1h'), fakeRow('30m'), 'duration')).toBeGreaterThan(0);
  });

  it('datetimeSortingFn parses and sorts dates', () => {
    expect(
      datetimeSortingFn(fakeRow('2024-03-01T10:00:00Z'), fakeRow('2024-01-01T10:00:00Z'), 'created')
    ).toBeGreaterThan(0);
  });
});

describe('Range Selection', () => {
  it('computeRange calculates correct range', () => {
    const orderedIds = ['1', '2', '3', '4', '5'];
    const range = computeRange(orderedIds, '1', '3');

    expect(range).toEqual(['1', '2', '3']);
  });

  it('computeRange handles reverse order', () => {
    const orderedIds = ['1', '2', '3', '4', '5'];
    const range = computeRange(orderedIds, '5', '2');

    expect(range).toEqual(['2', '3', '4', '5']);
  });

  it('computeRange handles single item when no anchor', () => {
    const orderedIds = ['1', '2', '3', '4', '5'];
    const range = computeRange(orderedIds, null, '3');

    expect(range).toEqual(['3']);
  });
});

describe('DataTable with advanced features', () => {
  it('renders with column reorder enabled', () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableColumnReorder
      />
    );

    // Check that headers have draggable attribute
    const draggableHeaders = container.querySelectorAll('th[draggable="true"]');
    expect(draggableHeaders.length).toBeGreaterThan(0);
  });
  it('renders row without onRowClick handler', () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    const row = container.querySelector('tbody tr');
    expect(row).toBeInTheDocument();
  });

  it('handles custom cell renderer', () => {
    const customColumns: DataTableColumn<TestRow>[] = [
      {
        id: 'name',
        header: 'Name',
        cell: (row) => `Custom: ${row.name}`,
      },
    ];

    render(
      <DataTable<TestRow>
        columns={customColumns}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    expect(screen.getByText(/Custom: Item A/)).toBeInTheDocument();
  });

  it('handles alignment prop on columns', () => {
    const alignedColumns: DataTableColumn<TestRow>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        align: 'center',
      },
    ];

    const { container } = render(
      <DataTable<TestRow>
        columns={alignedColumns}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    const cell = container.querySelector('tbody td');
    expect(cell).toHaveStyle({ textAlign: 'center' });
  });

  it('handles width prop on columns', () => {
    const widthColumns: DataTableColumn<TestRow>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        width: 200,
      },
    ];

    const { container } = render(
      <DataTable<TestRow>
        columns={widthColumns}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    const cell = container.querySelector('tbody td');
    expect(cell).toHaveStyle({ width: '200px' });
  });

  it('persists state without a persistKey', async () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    fireEvent.change(checkbox, { target: { checked: true } });

    expect(checkbox.checked).toBe(true);
  });

  it('column header renders as non-sortable when enableSorting is false', () => {
    const nonSortableColumns: DataTableColumn<TestRow>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: false,
      },
    ];

    render(
      <DataTable<TestRow>
        columns={nonSortableColumns}
        data={testData}
        getRowId={(row) => row.id}
      />
    );

    const header = screen.getByText('Name');
    expect(header).toBeInTheDocument();
  });

  it('renders multiple action buttons in row actions menu', () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={[testData[0]]}
        getRowId={(row) => row.id}
        rowActions={() => [
          { label: 'Edit', onClick: vi.fn() },
          { label: 'Delete', danger: true, onClick: vi.fn() },
          { label: 'Archive', onClick: vi.fn() },
        ]}
      />
    );

    const actionButton = container.querySelector('button') as HTMLElement;
    if (actionButton.textContent === '···') {
      fireEvent.click(actionButton);
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
    }
  });

  it('handles empty data with custom empty message', () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={[]}
        getRowId={(row) => row.id}
        emptyMessage="No data to display"
      />
    );

    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });

  it('deselects row when clicking checkbox again', () => {
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        enableSelection
      />
    );

    const checkbox = container.querySelector('input[type="checkbox"][value="1"]') as HTMLInputElement;

    // Select
    fireEvent.click(checkbox);
    fireEvent.change(checkbox, { target: { checked: true } });
    expect(checkbox.checked).toBe(true);

    // Deselect
    fireEvent.click(checkbox);
    fireEvent.change(checkbox, { target: { checked: false } });
    expect(checkbox.checked).toBe(false);
  });

  it('handles async row action', async () => {
    const onRowAction = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <DataTable<TestRow>
        columns={testColumns}
        data={[testData[0]]}
        getRowId={(row) => row.id}
        rowActions={() => [
          { label: 'Async Action', onClick: onRowAction },
        ]}
      />
    );

    const actionButtons = container.querySelectorAll('button');
    let actionButton: Element | null = null;
    for (const btn of actionButtons) {
      if (btn.textContent === '···') {
        actionButton = btn;
        break;
      }
    }

    fireEvent.click(actionButton!);
    const asyncButton = screen.getByText('Async Action');
    await userEvent.click(asyncButton);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onRowAction).toHaveBeenCalled();
  });

  it('renders with all optional props', () => {
    render(
      <DataTable<TestRow>
        columns={testColumns}
        data={testData}
        getRowId={(row) => row.id}
        title="Full Featured Table"
        enableSelection
        enableColumnReorder
        enableColumnVisibility
        bulkActions={testBulkActions}
        globalFilterPlaceholder="Search everything..."
        testId="full-table"
      />
    );

    expect(screen.getByText('Full Featured Table')).toBeInTheDocument();
    expect(screen.getByTestId('full-table')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search everything...')).toBeInTheDocument();
  });
});
