/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * PersistentVolumeClaim Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes PersistentVolumeClaims.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzePersistentVolumeClaimStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import PersistentVolumeClaimYamlTab from '../../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab';
import PVCBoundPVTab from '../../k8s/resources/persistentvolumeclaims/PVCBoundPVTab';
import PVCConsumersTab from '../../k8s/resources/persistentvolumeclaims/PVCConsumersTab';
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

const AppAPIAny = AppAPI as any;

/**
 * Column definitions for PersistentVolumeClaims table
 */
export const pvcColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'status', label: 'Status' },
  { key: 'storage', label: 'Storage' },
  { key: 'accessModes', label: 'Access Modes' },
  { key: 'volumeName', label: 'Volume' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for PersistentVolumeClaims bottom panel
 */
export const pvcTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'boundpv', label: 'Bound PV', countable: false },
  { key: 'consumers', label: 'Consumers', countKey: 'consumers' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize persistent volume claim data from API response
 */
export const normalizePVC = (pvc: Record<string, any>): ResourceRow => ({
  name: pvc.name ?? pvc.Name,
  namespace: pvc.namespace ?? pvc.Namespace,
  status: pvc.status ?? pvc.Status ?? '-',
  storage: pvc.storage ?? pvc.Storage ?? '-',
  accessModes: Array.isArray(pvc.accessModes ?? pvc.AccessModes)
    ? (pvc.accessModes ?? pvc.AccessModes).join(', ')
    : '-',
  volumeName: pvc.volumeName ?? pvc.VolumeName ?? '-',
  age: pvc.age ?? pvc.Age ?? '-',
  labels: pvc.labels ?? pvc.Labels ?? pvc.metadata?.labels ?? {},
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
  { key: 'storage', label: 'Storage' },
  { key: 'accessModes', label: 'Access Modes' },
  { key: 'volumeName', label: 'Volume' },
  { key: 'name', label: 'PVC name', type: 'break-word' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderPVCPanelContent: RenderPanelContent = (
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
              resourceType="pvc"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n: string, ns?: string) => { await AppAPIAny.DeleteResource('persistentvolumeclaim', ns ?? '', n); }}
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
              namespace={row.namespace}
              kind="PersistentVolumeClaim"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'boundpv') {
    return <PVCBoundPVTab namespace={row.namespace} pvcName={row.name} pvName={row.volumeName} />;
  }

  if (tab === 'consumers') {
    return <PVCConsumersTab namespace={row.namespace} pvcName={row.name} />;
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="PersistentVolumeClaim"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    return <PersistentVolumeClaimYamlTab namespace={row.namespace} name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="PersistentVolumeClaim"
        namespace={row.namespace}
        name={row.name}
        onAnalyze={() => onAnalyze(row.namespace, row.name)}
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
 * Complete persistent volume claim configuration for GenericResourceTable
 */
export const pvcConfig: ResourceConfig = {
  resourceType: 'persistentvolumeclaim',
  resourceKind: 'PersistentVolumeClaim',
  columns: pvcColumns,
  tabs: pvcTabs,
  fetchFn: AppAPI.GetPersistentVolumeClaims,
  eventName: 'persistentvolumeclaims:update',
  analyzeFn: AnalyzePersistentVolumeClaimStream,
  normalize: normalizePVC,
  renderPanelContent: renderPVCPanelContent,
  onDelete: async (name: string, namespace?: string) => AppAPIAny.DeleteResource('persistentvolumeclaim', namespace ?? '', name),
  title: 'Persistent Volume Claims',
};

export default pvcConfig;
