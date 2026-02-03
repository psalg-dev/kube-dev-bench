/**
 * Base modal wrapper with standard overlay, container, and button styling.
 * Consolidates duplicated modal styling from 17+ components.
 * 
 * Each modal component had ~40 lines of identical inline style objects:
 * - overlay styles (position, background, z-index)
 * - modal container styles (background, border, padding, shadow)
 * - button styles (padding, border, colors)
 * 
 * @example
 * import { BaseModal, ModalButton, ModalPrimaryButton } from '@/components/BaseModal';
 * 
 * export function MyModal({ isOpen, onClose }) {
 *   return (
 *     <BaseModal
 *       isOpen={isOpen}
 *       onClose={onClose}
 *       title="My Modal"
 *       footer={
 *         <>
 *           <ModalButton onClick={onClose}>Cancel</ModalButton>
 *           <ModalPrimaryButton onClick={handleSave}>Save</ModalPrimaryButton>
 *         </>
 *       }
 *     >
 *       {content}
 *     </BaseModal>
 *   );
 * }
 */

import './BaseModal.css';

/**
 * Base modal component with standard overlay and container.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {string} [props.title] - Modal title (optional)
 * @param {number} [props.width=640] - Modal width in pixels
 * @param {number} [props.maxHeight] - Maximum height (defaults to 'calc(100vh - 48px)')
 * @param {React.ReactNode} props.children - Modal content
 * @param {React.ReactNode} [props.footer] - Footer content (buttons)
 * @param {string} [props.className] - Additional class name for the container
 * @param {string} [props.testId] - Test ID for the modal container
 * @param {string} [props.overlayId] - Optional id for the overlay element
 * @param {string} [props.overlayClassName] - Optional class name for the overlay element
 * @returns {JSX.Element|null}
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
  overlayId,
  overlayClassName = '',
}) {
  if (!isOpen) return null;

  const containerStyle = {
    width,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: maxHeight || 'calc(100vh - 48px)',
  };

  return (
    <div id={overlayId} className={`base-modal-overlay ${overlayClassName}`.trim()} onClick={onClose}>
      <div
        className={`base-modal-container ${className}`.trim()}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        {title && (
          <div className="base-modal-header">
            <h3 className="base-modal-title">{title}</h3>
            <button 
              className="base-modal-close" 
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        <div className="base-modal-content">
          {children}
        </div>
        {footer && (
          <div className="base-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Standard modal button.
 * 
 * @param {Object} props - Button props
 * @param {'default'|'primary'|'danger'} [props.variant='default'] - Button variant
 * @param {boolean} [props.disabled] - Whether button is disabled
 * @param {React.ReactNode} props.children - Button content
 */
export function ModalButton({ variant = 'default', className = '', children, ...props }) {
  const variantClass = variant !== 'default' ? `base-modal-btn-${variant}` : '';
  return (
    <button
      className={`base-modal-btn ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Primary action button (green).
 */
export function ModalPrimaryButton(props) {
  return <ModalButton variant="primary" {...props} />;
}

/**
 * Danger action button (red).
 */
export function ModalDangerButton(props) {
  return <ModalButton variant="danger" {...props} />;
}

export default BaseModal;
