/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * Job Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes Jobs.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeJobStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import AggregateLogsTab from '../../components/AggregateLogsTab';
import JobPodsTab from '../../k8s/resources/jobs/JobPodsTab';
import JobYamlTab from '../../k8s/resources/jobs/JobYamlTab';
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
 * Column definitions for Jobs table
 */
export const jobColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'completions', label: 'Completions' },
  { key: 'succeeded', label: 'Succeeded' },
  { key: 'active', label: 'Active' },
  { key: 'failed', label: 'Failed' },
  { key: 'age', label: 'Age' },
  { key: 'duration', label: 'Duration' },
  { key: 'image', label: 'Image' },
];

/**
 * Tab definitions for Jobs bottom panel
 */
export const jobTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize job data from API response
 */
export const normalizeJob = (j: Record<string, any>): ResourceRow => ({
  name: j.name ?? j.Name,
  namespace: j.namespace ?? j.Namespace,
  completions: j.completions ?? j.Completions ?? 0,
  succeeded: j.succeeded ?? j.Succeeded ?? 0,
  active: j.active ?? j.Active ?? 0,
  failed: j.failed ?? j.Failed ?? 0,
  age: j.age ?? j.Age ?? '-',
  duration: j.duration ?? j.Duration ?? '-',
  image: j.image ?? j.Image ?? '',
  labels: j.labels ?? j.Labels ?? j.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'completions',
    label: 'Completions',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, any>) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'succeeded', label: 'Succeeded' },
  { key: 'active', label: 'Active' },
  { key: 'failed', label: 'Failed' },
  { key: 'duration', label: 'Duration' },
  { key: 'image', label: 'Image', type: 'break-word' },
  { key: 'name', label: 'Job name', type: 'break-word' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderJobPanelContent: RenderPanelContent = (
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
              resourceType="job"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n: string, ns?: string) => { await AppAPIAny.DeleteResource('job', ns ?? '', n); }}
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
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <AggregateLogsTab
                title="Logs"
                reloadKey={`${row.namespace}/${row.name}`}
                loadLogs={() => AppAPI.GetJobLogs(row.namespace, row.name)}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="Job"
                name={row.name}
                limit={20}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'pods') {
    return <JobPodsTab namespace={row.namespace} jobName={row.name} />;
  }

  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Job Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPI.GetJobLogs(row.namespace, row.name)}
      />
    );
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Job"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    return <JobYamlTab namespace={row.namespace} name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Job"
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
 * Complete job configuration for GenericResourceTable
 */
export const jobConfig: ResourceConfig = {
  resourceType: 'job',
  resourceKind: 'Job',
  columns: jobColumns,
  tabs: jobTabs,
  fetchFn: AppAPI.GetJobs,
  eventName: 'jobs:update',
  analyzeFn: AnalyzeJobStream,
  normalize: normalizeJob,
  renderPanelContent: renderJobPanelContent,
  onDelete: async (name: string, namespace?: string) => AppAPIAny.DeleteResource('job', namespace ?? '', name),
  title: 'Jobs',
};

export default jobConfig;
