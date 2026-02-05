/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Swarm Volume Resource Configuration
 *
 * Configuration for GenericResourceTable to display Docker Swarm Volumes.
 */

import { GetSwarmVolumes, BackupSwarmVolume, CloneSwarmVolume, RemoveSwarmVolume, RestoreSwarmVolume } from '../../../docker/swarmApi';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../../../docker/resources/SwarmResourceActions';
import VolumeUsedBySection from '../../../docker/resources/volumes/VolumeUsedBySection';
import VolumeFilesTab from '../../../docker/resources/volumes/VolumeFilesTab';
import VolumeInspectTab from '../../../docker/resources/volumes/VolumeInspectTab';
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
 * Column definitions for Swarm Volumes table
 */
export const swarmVolumeColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'driver', label: 'Driver' },
  { key: 'scope', label: 'Scope' },
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
 * Tab definitions for Swarm Volumes bottom panel
 */
export const swarmVolumeTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'files', label: 'Files' },
  { key: 'inspect', label: 'JSON' },
];

/**
 * Normalize swarm volume data from API response
 */
export const normalizeSwarmVolume = (vol: Record<string, any>): ResourceRow => ({
  name: vol.name ?? vol.Name,
  driver: vol.driver ?? vol.Driver,
  scope: vol.scope ?? vol.Scope,
  mountpoint: vol.mountpoint ?? vol.Mountpoint,
  createdAt: vol.createdAt ?? vol.CreatedAt,
  labels: vol.labels ?? vol.Labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  { key: 'name', label: 'Name' },
  { key: 'driver', label: 'Driver' },
  { key: 'scope', label: 'Scope' },
  { key: 'mountpoint', label: 'Mountpoint', type: 'break-word' },
  { key: 'createdAt', label: 'Created', type: 'date' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderSwarmVolumePanelContent: RenderPanelContent = (
  row,
  tab,
  _holmesState,
  _onAnalyze,
  _onCancel,
  panelApi
) => {
  if (tab === 'summary') {
    const handleDelete = async () => {
      if (!window.confirm(`Delete volume "${row.name}"?`)) return;
      try {
        await RemoveSwarmVolume(row.name, false);
        showSuccess(`Volume "${row.name}" deleted`);
        panelApi?.refresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to delete volume: ${message}`);
      }
    };

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels}
          actions={
            <SwarmResourceActions
              resourceType="volume"
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
          <VolumeUsedBySection volumeName={row.name} />
        </div>
      </div>
    );
  }

  if (tab === 'files') {
    return <VolumeFilesTab volumeName={row.name} />;
  }

  if (tab === 'inspect') {
    return <VolumeInspectTab volumeName={row.name} />;
  }

  return null;
};

/**
 * Get row actions for Swarm Volume
 */
const makeDefaultCloneName = (base: string) => {
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${base}@${iso}`;
};

export const getSwarmVolumeRowActions = (row: ResourceRow, api?: PanelApi): RowAction[] => [
  {
    label: 'Backup',
    icon: '💾',
    onClick: async () => {
      const volumeName = row?.name ?? '';
      if (!volumeName) {
        showError('Missing volume name');
        return;
      }
      try {
        const saved = await BackupSwarmVolume(volumeName);
        if (!saved) return;
        showSuccess(`Backed up volume "${volumeName}"`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to back up volume: ${message}`);
      }
    },
  },
  {
    label: 'Restore…',
    icon: '♻️',
    onClick: async () => {
      const volumeName = row?.name ?? '';
      if (!volumeName) {
        showError('Missing volume name');
        return;
      }
      if (!window.confirm(`Restore a backup into volume "${volumeName}"? This may overwrite files.`)) return;
      try {
        const selected = await RestoreSwarmVolume(volumeName);
        if (!selected) return;
        showSuccess(`Restored backup into volume "${volumeName}"`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to restore volume: ${message}`);
      }
    },
  },
  {
    label: 'Clone…',
    icon: '🧬',
    onClick: async () => {
      const volumeName = row?.name ?? '';
      if (!volumeName) {
        showError('Missing volume name');
        return;
      }
      const newName = window.prompt('New volume name', makeDefaultCloneName(volumeName));
      if (!newName) return;
      try {
        await CloneSwarmVolume(volumeName, newName);
        showSuccess(`Cloned volume to "${newName}"`);
        api?.refresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to clone volume: ${message}`);
      }
    },
  },
  {
    label: 'Delete',
    icon: '🗑️',
    danger: true,
    onClick: async () => {
      const volumeName = row?.name ?? '';
      if (!volumeName) {
        showError('Missing volume name');
        return;
      }
      if (!window.confirm(`Delete volume "${volumeName}"?`)) return;
      try {
        await RemoveSwarmVolume(volumeName, false);
        showSuccess(`Volume "${volumeName}" deleted`);
        api?.refresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to delete volume: ${message}`);
      }
    },
  },
];

/**
 * Complete config for GenericResourceTable
 */
export const swarmVolumeConfig: ResourceConfig = {
  resourceType: 'swarm-volume',
  resourceKind: 'Volume',
  columns: swarmVolumeColumns,
  tabs: swarmVolumeTabs,
  fetchFn: GetSwarmVolumes,
  eventName: 'swarm:volumes:update',
  normalize: normalizeSwarmVolume,
  renderPanelContent: renderSwarmVolumePanelContent,
  getRowActions: getSwarmVolumeRowActions,
  clusterScoped: true,
  createPlatform: 'swarm',
  createKind: 'volume',
  title: 'Swarm Volumes',
  tableTestId: 'swarm-volumes-table',
};
