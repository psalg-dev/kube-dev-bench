/**
 * ConfigSummaryPanel Component
 *
 * Summary panel for Swarm Configs with Edit and Compare modal support.
 * Used by configConfig.jsx for renderPanelContent.
 */

import { useState } from 'react';
import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ConfigDataSection from './ConfigDataSection';
import ConfigUsedBySection from './ConfigUsedBySection';
import ConfigEditModal from './ConfigEditModal';
import ConfigCompareModal from './ConfigCompareModal';
import { CloneSwarmConfig, ExportSwarmConfig, RemoveSwarmConfig } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';

const quickInfoFields = [
  { key: 'id', label: 'Config ID', type: 'break-word' },
  { key: 'name', label: 'Name' },
  {
    key: 'dataSize',
    label: 'Data Size',
    getValue: (d) => {
      const size = d.dataSize;
      if (size === undefined || size === null) return '-';
      if (size < 1024) return `${size} bytes`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    },
  },
  { key: 'createdAt', label: 'Created', type: 'date' },
  { key: 'updatedAt', label: 'Updated', type: 'date' },
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

export default function ConfigSummaryPanel({ row, allConfigs = [], panelApi }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const makeDefaultCloneName = () => {
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `${row.name}@${iso}`;
  };

  const handleDelete = async () => {
    try {
      await RemoveSwarmConfig(row.id);
      showSuccess(`Config ${row.name} removed`);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to remove config: ${err}`);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const savedPath = await ExportSwarmConfig(row.id, `${row.name}.txt`);
      if (!savedPath) return;
      showSuccess(`Saved config ${row.name}`);
    } catch (err) {
      showError(`Failed to download config: ${err}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleClone = async () => {
    const newName = window.prompt('New config name', makeDefaultCloneName());
    if (!newName) return;

    setCloning(true);
    try {
      await CloneSwarmConfig(row.id, newName);
      showSuccess(`Cloned config to ${newName}`);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to clone config: ${err}`);
    } finally {
      setCloning(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader
        name={row.name}
        labels={row.labels}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" style={buttonStyle} onClick={() => setShowEdit(true)}>
              Edit
            </button>
            <button
              type="button"
              id="swarm-config-compare-btn"
              style={buttonStyle}
              onClick={() => setShowCompare(true)}
            >
              Compare
            </button>
            <button
              type="button"
              id="swarm-config-download-btn"
              style={buttonStyle}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <button
              type="button"
              id="swarm-config-clone-btn"
              style={buttonStyle}
              onClick={handleClone}
              disabled={cloning}
            >
              {cloning ? 'Cloning...' : 'Clone'}
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
            <ConfigDataSection configId={row.id} configName={row.name} />
          </div>
          <div style={{ width: 320, minWidth: 200, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)' }}>
            <ConfigUsedBySection configId={row.id} />
          </div>
        </div>
      </div>

      <ConfigEditModal
        open={showEdit}
        configId={row.id}
        configName={row.name}
        onClose={() => setShowEdit(false)}
        onSaved={() => {
          setShowEdit(false);
          panelApi?.refresh?.();
        }}
      />

      <ConfigCompareModal
        open={showCompare}
        onClose={() => setShowCompare(false)}
        config={row}
        allConfigs={allConfigs}
      />
    </div>
  );
}
