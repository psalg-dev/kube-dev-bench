import { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import NetworkConnectedServicesTable from './NetworkConnectedServicesTable.jsx';
import NetworkConnectedContainersTable from './NetworkConnectedContainersTable.jsx';
import NetworkInspectTab from './NetworkInspectTab.jsx';
import { NetworkIPAMSection, NetworkOptionsSection } from './NetworkDetailsSections.jsx';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';
import {
  GetSwarmNetworks,
  GetSwarmNetworkServices,
  GetSwarmNetworkContainers,
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
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'services', label: 'Connected Services', countKey: 'services' },
  { key: 'containers', label: 'Containers', countKey: 'containers' },
  { key: 'inspect', label: 'JSON', countable: false },
];

function renderPanelContent(row, tab, onRefresh) {
  const quickInfoFields = [
    { key: 'id', label: 'Network ID', type: 'break-word' },
    { key: 'name', label: 'Name' },
    { key: 'driver', label: 'Driver' },
    { key: 'scope', label: 'Scope' },
    { key: 'attachable', label: 'Attachable', getValue: (d) => d.attachable ? 'Yes' : 'No' },
    { key: 'internal', label: 'Internal', getValue: (d) => d.internal ? 'Yes' : 'No' },
    { key: 'labels', label: 'Labels', type: 'labels' },
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

  if (tab === 'summary') {
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
          {/* Middle column: Connected Services */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <NetworkConnectedServicesTable networkId={row.id} compact />
            </div>
            {/* Right column: Options and IPAM */}
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <NetworkOptionsSection options={row.options} />
              <NetworkIPAMSection ipam={row.ipam} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'services') {
    return <NetworkConnectedServicesTable networkId={row.id} />;
  }

  if (tab === 'containers') {
    return <NetworkConnectedContainersTable networkId={row.id} />;
  }

  if (tab === 'inspect') {
    return <NetworkInspectTab networkId={row.id} />;
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

  const fetchTabCountsForRow = useCallback(async (row) => {
    if (!row?.id) return {};
    const [services, containers] = await Promise.all([
      GetSwarmNetworkServices(row.id),
      GetSwarmNetworkContainers(row.id),
    ]);
    return {
      services: Array.isArray(services) ? services.length : 0,
      containers: Array.isArray(containers) ? containers.length : 0,
    };
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
      tabCountsFetcher={fetchTabCountsForRow}
      createPlatform="swarm"
      createKind="network"
      tableTestId="swarm-networks-table"
      getRowActions={(row) => {
        const isBuiltIn = ['bridge', 'host', 'none', 'ingress', 'docker_gwbridge'].includes(row.name);
        return [
          {
            label: 'Delete',
            icon: '🗑️',
            danger: true,
            disabled: isBuiltIn,
            onClick: async () => {
              if (isBuiltIn) return;
              if (!window.confirm(`Delete network "${row.name}"?`)) return;
              try {
                await RemoveSwarmNetwork(row.id);
                showSuccess(`Network ${row.name} removed`);
                refresh();
              } catch (err) {
                showError(`Failed to remove network: ${err}`);
              }
            },
          },
        ];
      }}
    />
  );
}
