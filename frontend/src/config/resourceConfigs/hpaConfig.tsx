/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * HorizontalPodAutoscaler Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes HPAs.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import type { app } from '../../../wailsjs/go/models';
import { AnalyzeHPAStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import { ResourceGraphTab } from '../../k8s/graph/ResourceGraphTab';
import HPATargetTab from '../../k8s/resources/hpa/HPATargetTab';
import HPAMetricsTab from '../../k8s/resources/hpa/HPAMetricsTab';
import HPAConditionsTab from '../../k8s/resources/hpa/HPAConditionsTab';
import HPAYamlTab from '../../k8s/resources/hpa/HPAYamlTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
} from '../../types/resourceConfigs';

/**
 * Column definitions for HPAs table
 */
export const hpaColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'targetKind', label: 'Target Kind' },
  { key: 'targetName', label: 'Target Name' },
  { key: 'minReplicas', label: 'Min' },
  { key: 'maxReplicas', label: 'Max' },
  { key: 'currentReplicas', label: 'Current' },
  { key: 'desiredReplicas', label: 'Desired' },
  { key: 'targetCPU', label: 'CPU Target' },
  { key: 'currentCPU', label: 'CPU Current' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for HPAs bottom panel
 */
export const hpaTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'target', label: 'Target', countable: false },
  { key: 'metrics', label: 'Metrics', countable: false },
  { key: 'conditions', label: 'Conditions', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize HPA data from API response
 */
export const normalizeHPA = (hpa: Record<string, any>): ResourceRow => {
  const data = hpa as app.HorizontalPodAutoscalerInfo;
  return {
    name: data.name ?? '',
    namespace: data.namespace ?? '',
    targetKind: data.targetKind ?? '-',
    targetName: data.targetName ?? '-',
    minReplicas: data.minReplicas ?? 1,
    maxReplicas: data.maxReplicas ?? 10,
    currentReplicas: data.currentReplicas ?? 0,
    desiredReplicas: data.desiredReplicas ?? 0,
    targetCPU: data.targetCPU ?? '-',
    currentCPU: data.currentCPU ?? '-',
    age: data.age ?? '-',
  };
};

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'targetKind',
    label: 'Target Kind',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, any>) => data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'targetName', label: 'Target Name' },
  { key: 'minReplicas', label: 'Min Replicas' },
  { key: 'maxReplicas', label: 'Max Replicas' },
  { key: 'currentReplicas', label: 'Current Replicas' },
  { key: 'desiredReplicas', label: 'Desired Replicas' },
  { key: 'name', label: 'HPA name', type: 'break-word' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderHPAPanelContent: RenderPanelContent = (
  row,
  tab,
  holmesState,
  onAnalyze,
  onCancel
) => {
  const hpa = row as unknown as app.HorizontalPodAutoscalerInfo;

  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={hpa.name} labels={{}} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={hpa.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace={hpa.namespace} kind="HorizontalPodAutoscaler" name={hpa.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'target') {
    return <HPATargetTab hpa={hpa} />;
  }

  if (tab === 'metrics') {
    return <HPAMetricsTab hpa={hpa} />;
  }

  if (tab === 'conditions') {
    return <HPAConditionsTab hpa={hpa} />;
  }

  if (tab === 'events') {
    return <ResourceEventsTab namespace={hpa.namespace} kind="HorizontalPodAutoscaler" name={hpa.name} />;
  }

  if (tab === 'yaml') {
    return <HPAYamlTab namespace={hpa.namespace} name={hpa.name} />;
  }

  if (tab === 'relationships') {
    return <ResourceGraphTab namespace={hpa.namespace} kind="HorizontalPodAutoscaler" name={hpa.name} />;
  }

  if (tab === 'holmes') {
    const key = `${hpa.namespace}/${hpa.name}`;
    return (
      <HolmesBottomPanel
        kind="HorizontalPodAutoscaler"
        namespace={hpa.namespace}
        name={hpa.name}
        onAnalyze={() => onAnalyze(hpa.namespace, hpa.name)}
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
 * Complete HPA configuration for GenericResourceTable
 */
export const hpaConfig: ResourceConfig = {
  resourceType: 'horizontalpodautoscaler',
  resourceKind: 'HorizontalPodAutoscaler',
  columns: hpaColumns,
  tabs: hpaTabs,
  fetchFn: AppAPI.GetHorizontalPodAutoscalers,
  eventName: 'horizontalpodautoscalers:update',
  analyzeFn: AnalyzeHPAStream,
  normalize: normalizeHPA,
  renderPanelContent: renderHPAPanelContent,
  title: 'Horizontal Pod Autoscalers',
  tableTestId: 'hpa-overview-table',
};

export default hpaConfig;
