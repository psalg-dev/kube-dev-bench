import { useEffect, useMemo, useState } from 'react';

export default function UpdateStackModal({
  open,
  stackName,
  initialComposeYAML,
  onClose,
  onConfirm,
}) {
  const [yaml, setYaml] = useState(initialComposeYAML || '');

  useEffect(() => {
    if (open) setYaml(initialComposeYAML || '');
  }, [open, initialComposeYAML]);

  const canSave = useMemo(() => {
    const trimmed = (yaml || '').trim();
    return trimmed.length > 0 && trimmed !== (initialComposeYAML || '').trim();
  }, [yaml, initialComposeYAML]);

  if (!open) return null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  };

  const modalStyle = {
    backgroundColor: 'var(--gh-bg, #0d1117)',
    borderRadius: 8,
    padding: 20,
    width: 860,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    overflow: 'hidden',
    border: '1px solid var(--gh-border, #30363d)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const buttonStyle = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)' }}>
            Update Stack: {stackName}
          </div>
          <button
            id="swarm-stack-update-close-btn"
            style={buttonStyle}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div
          style={{
            color: 'var(--gh-text-secondary, #8b949e)',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
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
          <button
            id="swarm-stack-update-cancel-btn"
            style={buttonStyle}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            id="swarm-stack-update-confirm-btn"
            style={{
              ...buttonStyle,
              backgroundColor: '#238636',
              color: '#fff',
              borderColor: '#238636',
            }}
            onClick={() => onConfirm?.((yaml || '').trim())}
            disabled={!canSave}
          >
            Redeploy
          </button>
        </div>
      </div>
    </div>
  );
}
