/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Swarm Network Resource Configuration
 *
 * Configuration for GenericResourceTable to display Docker Swarm Networks.
 */

import { GetSwarmNetworks, GetSwarmNetworkServices, GetSwarmNetworkContainers, RemoveSwarmNetwork } from '../../../docker/swarmApi';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../../../docker/resources/SwarmResourceActions';
import { NetworkConnectedServicesTable } from '../../../docker/resources/networks/NetworkConnectedServicesTable';
import { NetworkConnectedContainersTable } from '../../../docker/resources/networks/NetworkConnectedContainersTable';
import { NetworkInspectTab } from '../../../docker/resources/networks/NetworkInspectTab';
import { NetworkIPAMSection, NetworkOptionsSection } from '../../../docker/resources/networks/NetworkDetailsSections';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { showSuccess, showError } from '../../../notification';
import type {
  PanelApi,
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
  RowAction,
} from '../../../types/resourceConfigs';

/**
 * Column definitions for Swarm Networks table
 */
export const swarmNetworkColumns: ResourceColumn[] = [
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

/**
 * Tab definitions for Swarm Networks bottom panel
 */
export const swarmNetworkTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'services', label: 'Connected Services', countKey: 'services' },
  { key: 'containers', label: 'Containers', countKey: 'containers' },
  { key: 'inspect', label: 'Inspect', countable: false },
];

/**
 * Normalize swarm network data from API response
 */
export const normalizeSwarmNetwork = (net: Record<string, any>): ResourceRow => ({
  id: net.id ?? net.ID,
  name: net.name ?? net.Name,
  driver: net.driver ?? net.Driver,
  scope: net.scope ?? net.Scope,
  attachable: net.attachable ?? net.Attachable ?? false,
  internal: net.internal ?? net.Internal ?? false,
  createdAt: net.createdAt ?? net.CreatedAt ?? net.Created,
  labels: net.labels ?? net.Labels ?? {},
  options: net.options ?? net.Options ?? {},
  ipam: net.ipam ?? net.IPAM ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  { key: 'id', label: 'Network ID', type: 'break-word' },
  { key: 'name', label: 'Name' },
  { key: 'driver', label: 'Driver' },
  { key: 'scope', label: 'Scope' },
  { key: 'attachable', label: 'Attachable', getValue: (d: Record<string, any>) => d.attachable ? 'Yes' : 'No' },
  { key: 'internal', label: 'Internal', getValue: (d: Record<string, any>) => d.internal ? 'Yes' : 'No' },
  { key: 'labels', label: 'Labels', type: 'labels' },
  { key: 'createdAt', label: 'Created', type: 'date' },
] satisfies QuickInfoField[];

/**
 * Built-in networks that cannot be deleted
 */
const BUILT_IN_NETWORKS = ['bridge', 'host', 'none', 'ingress', 'docker_gwbridge'];

/**
 * Render panel content for each tab
 */
export const renderSwarmNetworkPanelContent: RenderPanelContent = (
  row,
  tab,
  _holmesState,
  _onAnalyze,
  _onCancel,
  panelApi
) => {
  const isBuiltIn = BUILT_IN_NETWORKS.includes(row.name);

  const handleDelete = async () => {
    try {
      await RemoveSwarmNetwork(row.id);
      showSuccess(`Network ${row.name} removed`);
      panelApi?.refresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to remove network: ${message}`);
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
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <NetworkConnectedServicesTable networkId={row.id} compact />
            </div>
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
};

/**
 * Fetch tab counts for a network row
 */
export const fetchSwarmNetworkTabCounts = async (row: ResourceRow) => {
  if (!row?.id) return {};
  const [services, containers] = await Promise.all([
    GetSwarmNetworkServices(row.id),
    GetSwarmNetworkContainers(row.id),
  ]);
  return {
    services: Array.isArray(services) ? services.length : 0,
    containers: Array.isArray(containers) ? containers.length : 0,
  };
};

/**
 * Get row actions for Swarm Network
 */
export const getSwarmNetworkRowActions = (row: ResourceRow, api?: PanelApi): RowAction[] => {
  const networkName = row?.name ?? '';
  const isBuiltIn = BUILT_IN_NETWORKS.includes(networkName);
  return [
    {
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      disabled: isBuiltIn,
      onClick: async () => {
        if (isBuiltIn) return;
        const networkId = row?.id;
        if (!networkId || !networkName) {
          showError('Missing network id');
          return;
        }
        if (!window.confirm(`Delete network "${networkName}"?`)) return;
        try {
          await RemoveSwarmNetwork(networkId);
          showSuccess(`Network ${networkName} removed`);
          api?.refresh?.();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to remove network: ${message}`);
        }
      },
    },
  ];
};

/**
 * Complete config for GenericResourceTable
 */
export const swarmNetworkConfig: ResourceConfig = {
  resourceType: 'swarm-network',
  resourceKind: 'Network',
  columns: swarmNetworkColumns,
  tabs: swarmNetworkTabs,
  fetchFn: GetSwarmNetworks,
  eventName: 'swarm:networks:update',
  normalize: normalizeSwarmNetwork,
  renderPanelContent: renderSwarmNetworkPanelContent,
  getRowActions: getSwarmNetworkRowActions,
  tabCountsFetcher: fetchSwarmNetworkTabCounts,
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'network',
  title: 'Docker Networks',
  tableTestId: 'swarm-networks-table',
};
