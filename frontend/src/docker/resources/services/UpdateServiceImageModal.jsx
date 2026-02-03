import { useEffect, useMemo, useState } from 'react';
import { BaseModal, ModalButton, ModalPrimaryButton } from '../../../components/BaseModal';

export default function UpdateServiceImageModal({ open, currentImage, serviceName, onClose, onConfirm }) {
  const [image, setImage] = useState(currentImage || '');

  useEffect(() => {
    if (open) setImage(currentImage || '');
  }, [open, currentImage]);

  const canSave = useMemo(() => {
    const trimmed = (image || '').trim();
    return trimmed.length > 0 && trimmed !== (currentImage || '').trim();
  }, [image, currentImage]);

  if (!open) return null;

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={`Update Service Image: ${serviceName}`}
      width={520}
    >
      <div style={{ marginBottom: 12, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
        This updates the service spec and triggers a redeploy.
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-secondary)' }}>
          Image (including tag)
        </label>
        <input
          id="swarm-service-update-image-input"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="repo/image:tag"
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'var(--gh-input-bg, #0d1117)',
            border: '1px solid var(--gh-border, #30363d)',
            borderRadius: 6,
            color: 'var(--gh-text)',
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ModalButton id="swarm-service-update-image-cancel-btn" onClick={onClose}>
          Cancel
        </ModalButton>
        <ModalPrimaryButton
          id="swarm-service-update-image-confirm-btn"
          onClick={() => onConfirm?.(image.trim())}
          disabled={!canSave}
        >
          Update
        </ModalPrimaryButton>
      </div>
    </BaseModal>
  );
}
