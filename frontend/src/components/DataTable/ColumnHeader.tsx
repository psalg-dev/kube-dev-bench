import { useRef, useState } from 'react';
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
  const draggedOverColumn = useRef<string | null>(null);

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

  const sortIcon =
    header.column.columnDef.enableSorting === false
      ? null
      : !header.column.getIsSorted()
        ? '↕'
        : header.column.getIsSorted() === 'asc'
          ? '↑'
          : '↓';

  return (
    <th
      draggable={enableReorder}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${isDragOver ? 'drag-over' : ''} ${sortable ? 'sortable' : ''}`}
      onClick={sortable ? onSort : undefined}
      style={{
        cursor: sortable ? 'pointer' : enableReorder ? 'grab' : 'default',
      }}
    >
      <div className="column-header-wrapper">
        <div className="column-header-content">
          {header.isPlaceholder ? null : (
            <>
              {flexRender(header.column.columnDef.header, header.getContext())}
              {sortable && sortIcon && <span className="sort-indicator">{sortIcon}</span>}
            </>
          )}
        </div>
      </div>
    </th>
  );
}
