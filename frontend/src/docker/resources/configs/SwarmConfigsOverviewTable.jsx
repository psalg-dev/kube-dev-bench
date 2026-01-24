import { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import ConfigDataTab from './ConfigDataTab.jsx';
import ConfigEditModal from './ConfigEditModal.jsx';
import ConfigInspectTab from './ConfigInspectTab.jsx';
import ConfigCompareModal from './ConfigCompareModal.jsx';
import ConfigUsedBySection from './ConfigUsedBySection.jsx';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { CloneSwarmConfig, ExportSwarmConfig, GetSwarmConfigs, RemoveSwarmConfig } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';

const columns = [
  { key: 'name', label: 'Name' },
  {
    key: 'dataSize',
    label: 'Size',
    cell: ({ getValue }) => {
      const size = getValue();
      if (size === undefined || size === null) return '-';
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    },
  },
  {
    key: 'createdAt',
    label: 'Created',
    cell: ({ getValue }) => formatTimestampDMYHMS(getValue()),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    cell: ({ getValue }) => formatTimestampDMYHMS(getValue()),
  },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'data', label: 'Data' },
  { key: 'inspect', label: 'Inspect' },
];

function ConfigSummaryPanel({ row, allConfigs, onRefresh }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const makeDefaultCloneName = () => {
    // Example: name@2026-01-06T15:30:12Z
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `${row.name}@${iso}`;
  };

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

  const handleDelete = async () => {
    try {
      await RemoveSwarmConfig(row.id);
      showSuccess(`Config ${row.name} removed`);
      onRefresh?.();
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
      onRefresh?.();
    } catch (err) {
      showError(`Failed to clone config: ${err}`);
    } finally {
      setCloning(false);
    }
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
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader
        name={row.name}
        labels={row.labels}
        actions={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={buttonStyle} onClick={() => setShowEdit(true)}>
              Edit
            </button>
            <button
              id="swarm-config-compare-btn"
              style={buttonStyle}
              onClick={() => setShowCompare(true)}
            >
              Compare
            </button>
            <button
              id="swarm-config-download-btn"
              style={buttonStyle}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <button
              id="swarm-config-clone-btn"
              style={buttonStyle}
              onClick={handleClone}
              disabled={cloning}
            >
              {cloning ? 'Cloning...' : 'Clone'}
            </button>
            <SwarmResourceActions
              resourceType="config"
              name={row.name}
              onDelete={handleDelete}
            />
          </div>
        )}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row.name}
          data={row}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <ConfigUsedBySection configId={row.id} />
      </div>

      <ConfigEditModal
        open={showEdit}
        configId={row.id}
        configName={row.name}
        onClose={() => setShowEdit(false)}
        onSaved={() => onRefresh?.()}
      />

      <ConfigCompareModal
        open={showCompare}
        baseConfigId={row.id}
        baseConfigName={row.name}
        configs={allConfigs}
        onClose={() => setShowCompare(false)}
      />
    </div>
  );
}

function renderPanelContent(row, tab, onRefresh, allConfigs) {
  if (tab === 'summary') {
    return <ConfigSummaryPanel row={row} allConfigs={allConfigs} onRefresh={onRefresh} />;
  }

  if (tab === 'data') {
    return <ConfigDataTab configId={row.id} configName={row.name} />;
  }

  if (tab === 'inspect') {
    return <ConfigInspectTab configId={row.id} />;
  }

  return null;
}

export default function SwarmConfigsOverviewTable() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const makeDefaultCloneName = (base) => {
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `${base}@${iso}`;
  };

  useEffect(() => {
    let active = true;

    const loadConfigs = async () => {
      try {
        const data = await GetSwarmConfigs();
        if (active) {
          setConfigs(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load configs:', err);
        if (active) {
          setConfigs([]);
          setLoading(false);
        }
      }
    };

    loadConfigs();

    const off = EventsOn('swarm:configs:update', (data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setConfigs(data);
      } else {
        refresh();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [refreshKey, refresh]);

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm configs...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Configs"
      columns={columns}
      data={configs}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh, configs)}
      createPlatform="swarm"
      createKind="config"
      tableTestId="swarm-configs-table"
      getRowActions={(row) => ([
        {
          label: 'Download',
          icon: '⬇️',
          onClick: async () => {
            try {
              const savedPath = await ExportSwarmConfig(row.id, `${row.name}.txt`);
              if (!savedPath) return;
              showSuccess(`Saved config ${row.name}`);
            } catch (err) {
              showError(`Failed to download config: ${err}`);
            }
          },
        },
        {
          label: 'Clone…',
          icon: '🧬',
          onClick: async () => {
            const newName = window.prompt('New config name', makeDefaultCloneName(row.name));
            if (!newName) return;
            try {
              await CloneSwarmConfig(row.id, newName);
              showSuccess(`Cloned config to ${newName}`);
              refresh();
            } catch (err) {
              showError(`Failed to clone config: ${err}`);
            }
          },
        },
        {
          label: 'Delete',
          icon: '🗑️',
          danger: true,
          onClick: async () => {
            if (!window.confirm(`Delete config "${row.name}"?`)) return;
            try {
              await RemoveSwarmConfig(row.id);
              showSuccess(`Config ${row.name} removed`);
              refresh();
            } catch (err) {
              showError(`Failed to remove config: ${err}`);
            }
          },
        },
      ])}
    />
  );
}
