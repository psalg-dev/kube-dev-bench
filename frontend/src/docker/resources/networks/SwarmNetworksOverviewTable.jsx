import React, { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import {
  GetSwarmNetworks,
  RemoveSwarmNetwork,
} from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'driver', label: 'Driver' },
  { key: 'scope', label: 'Scope', cell: ({ getValue }) => {
    const scope = getValue();
    const isSwarm = scope === 'swarm';
    return (
      <span style={{ color: isSwarm ? '#58a6ff' : 'inherit' }}>
        {scope}
      </span>
    );
  }},
  { key: 'attachable', label: 'Attachable', cell: ({ getValue }) => getValue() ? 'Yes' : 'No' },
  { key: 'internal', label: 'Internal', cell: ({ getValue }) => getValue() ? 'Yes' : 'No' },
  { key: 'createdAt', label: 'Created', cell: ({ getValue }) => {
    const val = getValue();
    if (!val) return '-';
    return formatTimestampDMYHMS(val);
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
];

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    const quickInfoFields = [
      { key: 'id', label: 'Network ID', type: 'break-word' },
      { key: 'name', label: 'Name' },
      { key: 'driver', label: 'Driver' },
      { key: 'scope', label: 'Scope' },
      { key: 'attachable', label: 'Attachable', getValue: (d) => d.attachable ? 'Yes' : 'No' },
      { key: 'internal', label: 'Internal', getValue: (d) => d.internal ? 'Yes' : 'No' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ];

    // Can't delete built-in networks
    const isBuiltIn = ['bridge', 'host', 'none', 'ingress', 'docker_gwbridge'].includes(row.name);

    const handleDelete = async () => {
      try {
        await RemoveSwarmNetwork(row.id);
        showSuccess(`Network ${row.name} removed`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove network: ${err}`);
      }
    };

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={
            !isBuiltIn && (
              <SwarmResourceActions
                resourceType="network"
                name={row.name}
                onDelete={handleDelete}
              />
            )
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

  return null;
}

export default function SwarmNetworksOverviewTable() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const loadNetworks = async () => {
      try {
        const data = await GetSwarmNetworks();
        if (active) {
          setNetworks(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load networks:', err);
        if (active) {
          setNetworks([]);
          setLoading(false);
        }
      }
    };

    loadNetworks();

    const off = EventsOn('swarm:networks:update', (data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setNetworks(data);
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
    return <div className="main-panel-loading">Loading networks...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Docker Networks"
      columns={columns}
      data={networks}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
      createPlatform="swarm"
      createKind="network"
      tableTestId="swarm-networks-table"
    />
  );
}
