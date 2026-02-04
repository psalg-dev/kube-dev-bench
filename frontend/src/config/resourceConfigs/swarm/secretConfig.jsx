/**
 * Swarm Secret Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Docker Swarm Secrets.
 */

import { GetSwarmSecrets, RemoveSwarmSecret } from '../../../docker/swarmApi';
import SecretInspectTab from '../../../docker/resources/secrets/SecretInspectTab';
import SecretSummaryPanel from '../../../docker/resources/secrets/SecretSummaryPanel';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { showSuccess, showError } from '../../../notification';

/**
 * Column definitions for Swarm Secrets table
 */
export const swarmSecretColumns = [
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

/**
 * Tab definitions for Swarm Secrets bottom panel
 */
export const swarmSecretTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'inspect', label: 'JSON' },
];

/**
 * Normalize swarm secret data from API response
 */
export const normalizeSwarmSecret = (secret) => ({
  id: secret.id ?? secret.ID,
  name: secret.name ?? secret.Name,
  createdAt: secret.createdAt ?? secret.CreatedAt,
  updatedAt: secret.updatedAt ?? secret.UpdatedAt,
  labels: secret.labels ?? secret.Labels ?? {},
  driverName: secret.driverName ?? secret.DriverName,
});

/**
 * Render panel content for each tab
 */
export const renderSwarmSecretPanelContent = (row, tab, _holmesState, _onAnalyze, _onCancel, panelApi) => {
  if (tab === 'summary') {
    return <SecretSummaryPanel row={row} panelApi={panelApi} />;
  }

  if (tab === 'inspect') {
    return <SecretInspectTab secretId={row.id} />;
  }

  return null;
};

/**
 * Get row actions for Swarm Secret
 */
export const getSwarmSecretRowActions = (row, api) => [
  {
    label: 'Delete',
    icon: '🗑️',
    danger: true,
    onClick: async () => {
      if (!window.confirm(`Delete secret "${row.name}"?`)) return;
      try {
        await RemoveSwarmSecret(row.id);
        showSuccess(`Secret "${row.name}" deleted`);
        api?.refresh?.();
      } catch (err) {
        showError(`Failed to delete secret: ${err}`);
      }
    },
  },
];

/**
 * Complete config for GenericResourceTable
 */
export const swarmSecretConfig = {
  resourceType: 'swarm-secret',
  resourceKind: 'Secret',
  columns: swarmSecretColumns,
  tabs: swarmSecretTabs,
  fetchFn: GetSwarmSecrets,
  eventName: 'swarm:secrets:update',
  normalize: normalizeSwarmSecret,
  renderPanelContent: renderSwarmSecretPanelContent,
  getRowActions: getSwarmSecretRowActions,
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'secret',
  title: 'Swarm Secrets',
  tableTestId: 'swarm-secrets-table',
};
