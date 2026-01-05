import React, { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import { GetSwarmSecrets, RemoveSwarmSecret } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';

const columns = [
  { key: 'name', label: 'Name' },
  {
    key: 'createdAt',
    label: 'Created',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return '-';
      return formatTimestampDMYHMS(val);
    },
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return '-';
      return formatTimestampDMYHMS(val);
    },
  },
  {
    key: 'labels',
    label: 'Labels',
    cell: ({ getValue }) => {
      const labels = getValue();
      if (!labels) return '-';
      const count = Object.keys(labels).length;
      return count > 0 ? `${count} label${count > 1 ? 's' : ''}` : '-';
    },
  },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
];

function renderPanelContent(row, tab, onRefresh) {
  if (tab !== 'summary') return null;

  const handleDelete = async () => {
    if (!window.confirm(`Delete secret "${row.name}"?`)) return;
    try {
      await RemoveSwarmSecret(row.id);
      showSuccess(`Secret "${row.name}" deleted`);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to delete secret: ${err}`);
    }
  };

  const quickInfoFields = [
    { key: 'id', label: 'ID', type: 'break-word' },
    { key: 'name', label: 'Name' },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'updatedAt', label: 'Updated', type: 'date' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader
        name={row.name}
        labels={row.labels}
        actions={(
          <SwarmResourceActions
            resourceType="secret"
            name={row.name}
            onDelete={handleDelete}
          />
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
      </div>
    </div>
  );
}

export default function SwarmSecretsOverviewTable() {
  const swarm = useSwarmState();
  const connected = swarm?.connected;
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!connected) {
      setSecrets([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadSecrets = async () => {
      try {
        const data = await GetSwarmSecrets();
        if (active) {
          setSecrets(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load secrets:', err);
        if (active) {
          setSecrets([]);
          setLoading(false);
        }
      }
    };

    loadSecrets();

    const off = EventsOn('swarm:secrets:update', (data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setSecrets(data);
      } else {
        refresh();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [connected, refreshKey, refresh]);

  if (!connected) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Not connected to Docker Swarm
      </div>
    );
  }

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm secrets...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Secrets"
      columns={columns}
      data={secrets}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
      createPlatform="swarm"
      createKind="secret"
      tableTestId="swarm-secrets-table"
    />
  );
}
