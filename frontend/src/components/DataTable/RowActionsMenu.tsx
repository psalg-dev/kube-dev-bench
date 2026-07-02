import { useEffect, useRef, useState } from 'react';
import type { RowAction } from './types';

interface RowActionsMenuProps<TRow> {
  row: TRow;
  actions: RowAction<TRow>[];
  onClose: () => void;
}

export function RowActionsMenu<TRow>({ row, actions, onClose }: RowActionsMenuProps<TRow>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleActionClick = async (action: RowAction<TRow>) => {
    if (action.disabled) return;
    try {
      await action.onClick(row);
    } finally {
      setIsClosing(true);
      setTimeout(onClose, 0);
    }
  };

  return (
    <div
      ref={menuRef}
      className="menu-content row-actions-menu"
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, i) => {
        const disabled = Boolean(action.disabled);
        const danger = Boolean(action.danger);
        const itemClassName = `context-menu-item${disabled ? ' is-disabled' : ''}${danger ? ' is-danger' : ''}`;
        return (
          <div
            key={`${action.label}-${i}`}
            className={itemClassName}
            onClick={() => handleActionClick(action)}
          >
            {action.icon ? (
              <span aria-hidden="true" className="context-menu-icon">
                {action.icon}
              </span>
            ) : (
              <span aria-hidden="true" className="context-menu-icon" />
            )}
            <span>{action.label}</span>
          </div>
        );
      })}
    </div>
  );
}
