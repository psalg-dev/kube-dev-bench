import React, { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import ConfigDataTab from './ConfigDataTab.jsx';
import {
  GetSwarmConfigs,
  RemoveSwarmConfig,
} from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'dataSize', label: 'Size', cell: ({ getValue }) => {
    const size = getValue();
    if (size === undefined || size === null) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }},
  { key: 'createdAt', label: 'Created', cell: ({ getValue }) => {
    const val = getValue();
    if (!val) return '-';
    try {
      return new Date(val).toLocaleString();
    } catch {
      return val;
    }
  }},
  { key: 'updatedAt', label: 'Updated', cell: ({ getValue }) => {
    const val = getValue();
    if (!val) return '-';
    try {
      return new Date(val).toLocaleString();
    } catch {
      return val;
    }
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'data', label: 'Data' },
];

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    const quickInfoFields = [
      { key: 'id', label: 'Config ID', type: 'break-word' },
      { key: 'name', label: 'Name' },
      { key: 'dataSize', label: 'Data Size', getValue: (d) => {
        const size = d.dataSize;
        if (size === undefined || size === null) return '-';
        if (size < 1024) return `${size} bytes`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / 1024 / 1024).toFixed(1)} MB`;
      }},
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

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={
            <SwarmResourceActions
              resourceType="config"
              name={row.name}
              onDelete={handleDelete}
            />
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
        </div>
      </div>
    );
  }

  if (tab === 'data') {
    return <ConfigDataTab configId={row.id} configName={row.name} />;
  }

  return null;
}

export default function SwarmConfigsOverviewTable() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

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

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm configs...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Configs"
      columns={columns}
      data={configs}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
      createPlatform="swarm"
      createKind="config"
    />
  );
}
