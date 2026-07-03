import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RowAction } from './types';

interface RowActionsMenuProps<TRow> {
  row: TRow;
  actions: RowAction<TRow>[];
  anchorEl: HTMLElement;
  onClose: () => void;
}

const MARGIN = 8;

export function RowActionsMenu<TRow>({ row, actions, anchorEl, onClose }: RowActionsMenuProps<TRow>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the portaled menu against the anchor button using fixed viewport
  // coordinates. Flip above the anchor if it would overflow the bottom edge,
  // and clamp within the viewport so it is never clipped.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const anchor = anchorEl.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = menu;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchor.right - w; // right-align under the button
    left = Math.min(Math.max(MARGIN, left), vw - w - MARGIN);

    let top = anchor.bottom + 4;
    if (top + h > vh - MARGIN) {
      const flipped = anchor.top - h - 4;
      top = flipped >= MARGIN ? flipped : Math.max(MARGIN, vh - h - MARGIN);
    }
    setPos({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Fixed coords go stale on scroll/resize — close rather than chase them.
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const handleActionClick = async (action: RowAction<TRow>) => {
    if (action.disabled) return;
    try {
      await action.onClick(row);
    } finally {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className="menu-content row-actions-menu"
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
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
    </div>,
    document.body
  );
}
