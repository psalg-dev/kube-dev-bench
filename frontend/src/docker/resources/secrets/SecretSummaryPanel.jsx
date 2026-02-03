/**
 * SecretSummaryPanel Component
 *
 * Summary panel for Swarm Secrets with Edit, Rotate, Clone, and Delete functionality.
 * Used by secretConfig.jsx for renderPanelContent.
 */

import { useState } from 'react';
import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SecretDataSection from './SecretDataSection';
import SecretUsedBySection from './SecretUsedBySection';
import SecretEditModal from './SecretEditModal';
import SecretCloneModal from './SecretCloneModal';
import { RemoveSwarmSecret } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';

const quickInfoFields = [
  { key: 'id', label: 'Secret ID', type: 'break-word' },
  { key: 'name', label: 'Name' },
  { key: 'createdAt', label: 'Created', type: 'date' },
  { key: 'updatedAt', label: 'Updated', type: 'date' },
  {
    key: 'driverName',
    label: 'Driver',
    getValue: (d) => d?.driverName || '-',
  },
  {
    key: 'external',
    label: 'External',
    getValue: (d) => (d?.driverName ? 'Yes' : 'No'),
  },
];

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

export default function SecretSummaryPanel({ row, panelApi }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showRotate, setShowRotate] = useState(false);
  const [showClone, setShowClone] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete secret "${row.name}"?`)) return;
    try {
      await RemoveSwarmSecret(row.id);
      showSuccess(`Secret "${row.name}" deleted`);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to delete secret: ${err}`);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader
        name={row.name}
        labels={row.labels}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              id="swarm-secret-edit-btn"
              style={buttonStyle}
              onClick={() => setShowEdit(true)}
            >
              Edit
            </button>
            <button
              type="button"
              id="swarm-secret-rotate-btn"
              style={buttonStyle}
              onClick={() => setShowRotate(true)}
            >
              Rotate
            </button>
            <button
              type="button"
              id="swarm-secret-clone-btn"
              style={buttonStyle}
              onClick={() => setShowClone(true)}
            >
              Clone
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, color: '#f85149', borderColor: '#f85149' }}
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        }
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row.name}
          data={row}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <SecretDataSection secretId={row.id} secretName={row.name} />
          </div>
          <div style={{ width: 320, minWidth: 200, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)' }}>
            <SecretUsedBySection secretId={row.id} />
          </div>
        </div>
      </div>

      <SecretEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        secret={row}
        mode="edit"
        onSave={() => {
          setShowEdit(false);
          panelApi?.refresh?.();
        }}
      />

      <SecretEditModal
        open={showRotate}
        onClose={() => setShowRotate(false)}
        secret={row}
        mode="rotate"
        onSave={() => {
          setShowRotate(false);
          panelApi?.refresh?.();
        }}
      />

      <SecretCloneModal
        open={showClone}
        onClose={() => setShowClone(false)}
        secret={row}
        onClone={() => {
          setShowClone(false);
          panelApi?.refresh?.();
        }}
      />
    </div>
  );
}
