/**
 * Swarm Config Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Docker Swarm Configs.
 */

import { GetSwarmConfigs, CloneSwarmConfig, ExportSwarmConfig, RemoveSwarmConfig } from '../../../docker/swarmApi';
import ConfigDataTab from '../../../docker/resources/configs/ConfigDataTab';
import ConfigInspectTab from '../../../docker/resources/configs/ConfigInspectTab';
import ConfigSummaryPanel from '../../../docker/resources/configs/ConfigSummaryPanel';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { showSuccess, showError } from '../../../notification';

/**
 * Column definitions for Swarm Configs table
 */
export const swarmConfigColumns = [
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
export const swarmConfigTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'data', label: 'Data' },
  { key: 'inspect', label: 'Inspect' },
];

/**
 * Normalize swarm config data from API response
 */
export const normalizeSwarmConfig = (config) => ({
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
export const renderSwarmConfigPanelContent = (row, tab, _holmesState, _onAnalyze, _onCancel, panelApi, allData) => {
  if (tab === 'summary') {
    return <ConfigSummaryPanel row={row} allConfigs={allData} panelApi={panelApi} />;
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
const makeDefaultCloneName = (base) => {
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${base}@${iso}`;
};

export const getSwarmConfigRowActions = (row, api) => [
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
        api?.refresh?.();
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
        api?.refresh?.();
      } catch (err) {
        showError(`Failed to remove config: ${err}`);
      }
    },
  },
];

/**
 * Complete config for GenericResourceTable
 */
export const swarmConfigConfig = {
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
