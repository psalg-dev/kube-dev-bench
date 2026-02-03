import { useEffect, useMemo, useState } from 'react';
import { BaseModal, ModalButton, ModalPrimaryButton } from '../../../components/BaseModal';

export default function UpdateStackModal({ open, stackName, initialComposeYAML, onClose, onConfirm }) {
  const [yaml, setYaml] = useState(initialComposeYAML || '');

  useEffect(() => {
    if (open) setYaml(initialComposeYAML || '');
  }, [open, initialComposeYAML]);

  const canSave = useMemo(() => {
    const trimmed = (yaml || '').trim();
    return trimmed.length > 0 && trimmed !== (initialComposeYAML || '').trim();
  }, [yaml, initialComposeYAML]);

  if (!open) return null;

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={`Update Stack: ${stackName}`}
      width={860}
    >
      <div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, lineHeight: 1.4 }}>
        This will run a stack redeploy using the Docker CLI.
      </div>

      <textarea
        id="swarm-stack-update-yaml"
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: 360,
          resize: 'none',
          padding: 12,
          backgroundColor: 'var(--gh-input-bg, #0d1117)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: 6,
          color: 'var(--gh-text, #c9d1d9)',
          fontSize: 13,
          fontFamily: 'monospace',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ModalButton id="swarm-stack-update-cancel-btn" onClick={onClose}>
          Cancel
        </ModalButton>
        <ModalPrimaryButton
          id="swarm-stack-update-confirm-btn"
          onClick={() => onConfirm?.((yaml || '').trim())}
          disabled={!canSave}
        >
          Redeploy
        </ModalPrimaryButton>
      </div>
    </BaseModal>
  );
}
