/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PersistentVolume Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes PersistentVolumes.
 * Note: PVs are cluster-scoped resources.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzePersistentVolumeStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import PersistentVolumeYamlTab from '../../k8s/resources/persistentvolumes/PersistentVolumeYamlTab';
import PVBoundPVCTab from '../../k8s/resources/persistentvolumes/PVBoundPVCTab';
import PVAnnotationsTab from '../../k8s/resources/persistentvolumes/PVAnnotationsTab';
import PVCapacityUsageTab from '../../k8s/resources/persistentvolumes/PVCapacityUsageTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
} from '../../types/resourceConfigs';

/**
 * Column definitions for PersistentVolumes table
 */
export const pvColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'accessModes', label: 'Access Modes' },
  { key: 'reclaimPolicy', label: 'Reclaim Policy' },
  { key: 'status', label: 'Status' },
  { key: 'claim', label: 'Claim' },
  { key: 'storageClass', label: 'Storage Class' },
  { key: 'volumeType', label: 'Type' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for PersistentVolumes bottom panel
 */
export const pvTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'boundpvc', label: 'Bound PVC', countable: false },
  { key: 'annotations', label: 'Annotations', countable: false },
  { key: 'usage', label: 'Capacity Usage', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize persistent volume data from API response
 */
export const normalizePV = (pv: Record<string, any>): ResourceRow => ({
  name: pv.name ?? pv.Name,
  namespace: pv.namespace ?? pv.Namespace ?? '',
  capacity: pv.capacity ?? pv.Capacity ?? '-',
  accessModes: pv.accessModes ?? pv.AccessModes ?? '-',
  reclaimPolicy: pv.reclaimPolicy ?? pv.ReclaimPolicy ?? '-',
  status: pv.status ?? pv.Status ?? '-',
  claim: pv.claim ?? pv.Claim ?? '-',
  storageClass: pv.storageClass ?? pv.StorageClass ?? '-',
  volumeType: pv.volumeType ?? pv.VolumeType ?? '-',
  age: pv.age ?? pv.Age ?? '-',
  labels: pv.labels ?? pv.Labels ?? pv.metadata?.labels ?? {},
  annotations: pv.annotations ?? pv.Annotations ?? pv.metadata?.annotations ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'status',
    label: 'Status',
    type: 'status',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, any>) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'accessModes', label: 'Access Modes' },
  { key: 'reclaimPolicy', label: 'Reclaim Policy' },
  { key: 'claim', label: 'Claim' },
  { key: 'storageClass', label: 'Storage Class' },
  { key: 'volumeType', label: 'Volume Type' },
  { key: 'name', label: 'PV name', type: 'break-word' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderPVPanelContent: RenderPanelContent = (
  row,
  tab,
  holmesState,
  onAnalyze,
  onCancel
) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="pv"
              name={row.name}
              namespace=""
              onDelete={async (n: string) => { await AppAPI.DeleteResource('pv', '', n); }}
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
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <ResourceEventsTab
              namespace=""
              kind="PersistentVolume"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'boundpvc') {
    return <PVBoundPVCTab pvName={row.name} claim={row.claim} />;
  }

  if (tab === 'annotations') {
    return <PVAnnotationsTab annotations={row.annotations || row.Annotations || row.metadata?.annotations || {}} />;
  }

  if (tab === 'usage') {
    return <PVCapacityUsageTab pvName={row.name} />;
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace=""
        kind="PersistentVolume"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    return <PersistentVolumeYamlTab name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = row.name; // PVs are cluster-scoped, no namespace
    return (
      <HolmesBottomPanel
        kind="PersistentVolume"
        namespace=""
        name={row.name}
        onAnalyze={() => onAnalyze('', row.name)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
        streamingText={holmesState.key === key ? holmesState.streamingText : ''}
        reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
        toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
        contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
      />
    );
  }

  return null;
};

/**
 * Complete persistent volume configuration for GenericResourceTable
 */
export const pvConfig: ResourceConfig = {
  resourceType: 'pv',
  resourceKind: 'PersistentVolume',
  columns: pvColumns,
  tabs: pvTabs,
  fetchFn: AppAPI.GetPersistentVolumes,
  eventName: 'persistentvolumes:update',
  analyzeFn: AnalyzePersistentVolumeStream,
  normalize: normalizePV,
  renderPanelContent: renderPVPanelContent,
  onDelete: async (name: string) => AppAPI.DeleteResource('pv', '', name),
  clusterScoped: true,
  title: 'Persistent Volumes',
};

export default pvConfig;
