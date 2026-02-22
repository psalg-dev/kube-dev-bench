import type { ReactNode } from 'react';
import { BaseModal, ModalButton, ModalDangerButton, ModalPrimaryButton } from '../BaseModal';
import './ConfirmDialog.css';

type ConfirmDialogProps = {
  isOpen: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
};

export default function ConfirmDialog({
  isOpen,
  title = 'Confirm action',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
  testId,
}: ConfirmDialogProps) {
  const confirmButton = confirmVariant === 'danger'
    ? (
      <ModalDangerButton type="button" onClick={onConfirm} disabled={isBusy}>
        {confirmLabel}
      </ModalDangerButton>
    ) : (
      <ModalPrimaryButton type="button" onClick={onConfirm} disabled={isBusy}>
        {confirmLabel}
      </ModalPrimaryButton>
    );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      width={420}
      className="confirm-dialog"
      testId={testId}
      footer={(
        <>
          <ModalButton type="button" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </ModalButton>
          {confirmButton}
        </>
      )}
    >
      {description && <p className="confirm-dialog-description">{description}</p>}
    </BaseModal>
  );
}
