import { useState } from 'react';
import { flexRender } from '@tanstack/react-table';
import type { Header } from '@tanstack/react-table';

interface ColumnHeaderProps<TRow> {
  header: Header<TRow, unknown>;
  sortable: boolean;
  enableReorder?: boolean;
  onReorder?: (fromId: string, toId: string) => void;
  onSort?: () => void;
}

export function ColumnHeader<TRow>({
  header,
  sortable,
  enableReorder = false,
  onReorder,
  onSort,
}: ColumnHeaderProps<TRow>) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>) => {
    if (!enableReorder || !e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', header.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
    if (!enableReorder || !e.dataTransfer) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>) => {
    if (!enableReorder || !e.dataTransfer) return;
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    const toId = header.id;
    if (fromId !== toId && onReorder) {
      onReorder(fromId, toId);
    }
    setIsDragOver(false);
  };

  const sorted = header.column.getIsSorted();
  const sortIcon =
    header.column.columnDef.enableSorting === false
      ? null
      : !sorted
        ? '↕'
        : sorted === 'asc'
          ? '↑'
          : '↓';

  // ARIA sort state so tests / a11y tools can read the current sort direction.
  const ariaSort = sortable ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined;

  const label = header.isPlaceholder
    ? null
    : flexRender(header.column.columnDef.header, header.getContext());

  return (
    <th
      draggable={enableReorder}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${isDragOver ? 'drag-over' : ''} ${sortable ? 'sortable' : ''}`}
      aria-sort={ariaSort}
      onClick={sortable ? onSort : undefined}
      style={{
        cursor: sortable ? 'pointer' : enableReorder ? 'grab' : 'default',
      }}
    >
      <div className="column-header-wrapper">
        <div className="column-header-content">
          {header.isPlaceholder ? null : sortable ? (
            // Sortable header exposes a button so it's keyboard-operable with an accessible
            // name equal to the column label (sort glyph is aria-hidden). The sort handler
            // lives on the th; a button click/keypress bubbles to it (no double-fire).
            <button type="button" className="column-header-button">
              {label}
              {sortIcon && (
                <span className="sort-indicator" aria-hidden="true">
                  {sortIcon}
                </span>
              )}
            </button>
          ) : (
            label
          )}
        </div>
      </div>
    </th>
  );
}
