/**
 * Base modal wrapper with standard overlay, container, and button styling.
 * Consolidates duplicated modal styling from 17+ components.
 *
 * Each modal component had ~40 lines of identical inline style objects:
 * - overlay styles (position, background, z-index)
 * - modal container styles (background, border, padding, shadow)
 * - button styles (padding, border, colors)
 */

import './BaseModal.css';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Base modal component with standard overlay and container.
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  width = 640,
  maxHeight,
  children,
  footer,
  className = '',
  testId,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  maxHeight?: number | string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  testId?: string;
}) {
  if (!isOpen) return null;

  const containerStyle: React.CSSProperties = {
    width,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: maxHeight || 'calc(100vh - 48px)',
  };

  return (
    <div className="base-modal-overlay" onClick={onClose}>
      <div
        className={`base-modal-container ${className}`.trim()}
        style={containerStyle}
        onClick={(event) => event.stopPropagation()}
        data-testid={testId}
      >
        {title && (
          <div className="base-modal-header">
            <h3 className="base-modal-title">{title}</h3>
            <button className="base-modal-close" onClick={onClose} aria-label="Close modal">
              ×
            </button>
          </div>
        )}
        <div className="base-modal-content">{children}</div>
        {footer && <div className="base-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

type ModalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger';
  className?: string;
};

/**
 * Standard modal button.
 */
export function ModalButton({ variant = 'default', className = '', children, ...props }: ModalButtonProps) {
  const variantClass = variant !== 'default' ? `base-modal-btn-${variant}` : '';
  return (
    <button className={`base-modal-btn ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

/**
 * Primary action button (green).
 */
export function ModalPrimaryButton(props: Omit<ModalButtonProps, 'variant'>) {
  return <ModalButton variant="primary" {...props} />;
}

/**
 * Danger action button (red).
 */
export function ModalDangerButton(props: Omit<ModalButtonProps, 'variant'>) {
  return <ModalButton variant="danger" {...props} />;
}

export default BaseModal;
