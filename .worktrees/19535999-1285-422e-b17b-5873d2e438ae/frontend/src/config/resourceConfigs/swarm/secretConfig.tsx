/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Swarm Secret Resource Configuration
 *
 * Configuration for GenericResourceTable to display Docker Swarm Secrets.
 */

import { SecretInspectTab } from '../../../docker/resources/secrets/SecretInspectTab';
import { SecretSummaryPanel } from '../../../docker/resources/secrets/SecretSummaryPanel';
import { GetSwarmSecrets, RemoveSwarmSecret } from '../../../docker/swarmApi';
import { showError, showSuccess } from '../../../notification';
import type {
    PanelApi,
    RenderPanelContent,
    ResourceColumn,
    ResourceConfig,
    ResourceRow,
    ResourceTab,
    RowAction,
} from '../../../types/resourceConfigs';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';

/**
 * Column definitions for Swarm Secrets table
 */
export const swarmSecretColumns: ResourceColumn[] = [
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
export const swarmSecretTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'inspect', label: 'JSON' },
];

/**
 * Normalize swarm secret data from API response
 */
export const normalizeSwarmSecret = (secret: Record<string, any>): ResourceRow => ({
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
export const renderSwarmSecretPanelContent: RenderPanelContent = (
  row,
  tab
) => {
  if (tab === 'summary') {
    return <SecretSummaryPanel row={row} />;
  }

  if (tab === 'inspect') {
    return <SecretInspectTab secretId={row.id} />;
  }

  return null;
};

/**
 * Get row actions for Swarm Secret
 */
export const getSwarmSecretRowActions = (row: ResourceRow, api?: PanelApi): RowAction[] => [
  {
    label: 'Delete',
    icon: '🗑️',
    danger: true,
    onClick: async () => {
      const secretId = row?.id;
      const secretName = row?.name ?? 'secret';
      if (!secretId) {
        showError('Missing secret id');
        return;
      }
      if (!window.confirm(`Delete secret "${secretName}"?`)) return;
      try {
        await RemoveSwarmSecret(secretId);
        showSuccess(`Secret "${secretName}" deleted`);
        api?.refresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to delete secret: ${message}`);
      }
    },
  },
];

/**
 * Complete config for GenericResourceTable
 */
export const swarmSecretConfig: ResourceConfig = {
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
