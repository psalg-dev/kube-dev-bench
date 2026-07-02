import { useRef, useEffect } from 'react';
import type { DataTableColumn } from './types';

interface ColumnVisibilityMenuProps<TRow> {
  columns: DataTableColumn<TRow>[];
  visibility: Record<string, boolean>;
  onVisibilityChange: (columnId: string, visible: boolean) => void;
  onClose: () => void;
}

export function ColumnVisibilityMenu<TRow>({
  columns,
  visibility,
  onVisibilityChange,
  onClose,
}: ColumnVisibilityMenuProps<TRow>) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="column-visibility-dropdown">
      {columns
        .filter((col) => col.enableHiding !== false)
        .map((column) => (
          <label key={column.id} className="column-visibility-item">
            <input
              type="checkbox"
              checked={visibility[column.id] !== false}
              onChange={(e) => onVisibilityChange(column.id, e.target.checked)}
            />
            <span>{column.header}</span>
          </label>
        ))}
    </div>
  );
}
