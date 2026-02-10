/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Swarm Config Resource Configuration
 *
 * Configuration for GenericResourceTable to display Docker Swarm Configs.
 */

import { GetSwarmConfigs, CloneSwarmConfig, ExportSwarmConfig, RemoveSwarmConfig } from '../../../docker/swarmApi';
import { ConfigDataTab } from '../../../docker/resources/configs/ConfigDataTab';
import { ConfigInspectTab } from '../../../docker/resources/configs/ConfigInspectTab';
import { ConfigSummaryPanel } from '../../../docker/resources/configs/ConfigSummaryPanel';
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
 * Column definitions for Swarm Configs table
 */
export const swarmConfigColumns: ResourceColumn[] = [
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

/**
 * Tab definitions for Swarm Configs bottom panel
 */
export const swarmConfigTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'data', label: 'Data' },
  { key: 'inspect', label: 'Inspect' },
];

/**
 * Normalize swarm config data from API response
 */
export const normalizeSwarmConfig = (config: Record<string, any>): ResourceRow => ({
  id: config.id ?? config.ID,
  name: config.name ?? config.Name,
  dataSize: config.dataSize ?? config.DataSize,
  createdAt: config.createdAt ?? config.CreatedAt,
  updatedAt: config.updatedAt ?? config.UpdatedAt,
  labels: config.labels ?? config.Labels ?? {},
});

/**
 * Render panel content for each tab
 */
export const renderSwarmConfigPanelContent: RenderPanelContent = (
  row,
  tab,
  _holmesState,
  _onAnalyze,
  _onCancel,
  panelApi,
  allData
) => {
  if (tab === 'summary') {
    return <ConfigSummaryPanel row={row} />;
  }

  if (tab === 'data') {
    return <ConfigDataTab configId={row.id} configName={row.name} />;
  }

  if (tab === 'inspect') {
    return <ConfigInspectTab configId={row.id} />;
  }

  return null;
};

/**
 * Get row actions for Swarm Config
 */
const makeDefaultCloneName = (base: string) => {
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${base}@${iso}`;
};

export const getSwarmConfigRowActions = (row: ResourceRow, api?: PanelApi): RowAction[] => [
  {
    label: 'Download',
    icon: '⬇️',
    onClick: async () => {
      const configId = row?.id;
      const configName = row?.name ?? 'config';
      if (!configId) {
        showError('Missing config id');
        return;
      }
      try {
        const savedPath = await ExportSwarmConfig(configId, `${configName}.txt`);
        if (!savedPath) return;
        showSuccess(`Saved config ${configName}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to download config: ${message}`);
      }
    },
  },
  {
    label: 'Clone…',
    icon: '🧬',
    onClick: async () => {
      const configId = row?.id;
      const configName = row?.name ?? 'config';
      if (!configId) {
        showError('Missing config id');
        return;
      }
      const newName = window.prompt('New config name', makeDefaultCloneName(configName));
      if (!newName) return;
      try {
        await CloneSwarmConfig(configId, newName);
        showSuccess(`Cloned config to ${newName}`);
        api?.refresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to clone config: ${message}`);
      }
    },
  },
  {
    label: 'Delete',
    icon: '🗑️',
    danger: true,
    onClick: async () => {
      const configId = row?.id;
      const configName = row?.name ?? 'config';
      if (!configId) {
        showError('Missing config id');
        return;
      }
      if (!window.confirm(`Delete config "${configName}"?`)) return;
      try {
        await RemoveSwarmConfig(configId);
        showSuccess(`Config ${configName} removed`);
        api?.refresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to remove config: ${message}`);
      }
    },
  },
];

/**
 * Complete config for GenericResourceTable
 */
export const swarmConfigConfig: ResourceConfig = {
  resourceType: 'swarm-config',
  resourceKind: 'Config',
  columns: swarmConfigColumns,
  tabs: swarmConfigTabs,
  fetchFn: GetSwarmConfigs,
  eventName: 'swarm:configs:update',
  normalize: normalizeSwarmConfig,
  renderPanelContent: renderSwarmConfigPanelContent,
  getRowActions: getSwarmConfigRowActions,
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'config',
  title: 'Swarm Configs',
  tableTestId: 'swarm-configs-table',
};
