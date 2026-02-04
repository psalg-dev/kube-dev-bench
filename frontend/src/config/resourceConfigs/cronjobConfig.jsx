/**
 * CronJob Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes CronJobs.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeCronJobStream } from '../../holmes/holmesApi';
import QuickInfoSection from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import CronJobHistoryTab from '../../k8s/resources/cronjobs/CronJobHistoryTab';
import CronJobActionsTab from '../../k8s/resources/cronjobs/CronJobActionsTab';
import CronJobNextRunsTab from '../../k8s/resources/cronjobs/CronJobNextRunsTab';
import CronJobYamlTab from '../../k8s/resources/cronjobs/CronJobYamlTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';

/**
 * Column definitions for CronJobs table
 */
export const cronjobColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'suspend', label: 'Suspend' },
  { key: 'nextRun', label: 'Next run' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

/**
 * Tab definitions for CronJobs bottom panel
 */
export const cronjobTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'history', label: 'History', ariaLabel: 'Job History', countKey: 'history' },
  { key: 'nextruns', label: 'Next Runs', countable: false },
  { key: 'actions', label: 'Actions', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize cronjob data from API response
 */
export const normalizeCronJob = (cj) => ({
  name: cj.name ?? cj.Name,
  namespace: cj.namespace ?? cj.Namespace,
  schedule: cj.schedule ?? cj.Schedule ?? '',
  suspend: cj.suspend ?? cj.Suspend ?? false,
  nextRun: cj.nextRun ?? cj.NextRun ?? '-',
  age: cj.age ?? cj.Age ?? '-',
  image: cj.image ?? cj.Image ?? '',
  labels: cj.labels ?? cj.Labels ?? cj.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'schedule',
    label: 'Schedule',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  {
    key: 'suspend',
    label: 'Suspend',
    getValue: (data) => data.suspend ? 'Yes' : 'No',
  },
  { key: 'nextRun', label: 'Next run' },
  { key: 'image', label: 'Image', type: 'break-word' },
  { key: 'name', label: 'CronJob name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderCronJobPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="cronjob"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n, ns) => { await AppAPI.DeleteResource('cronjob', ns, n); }}
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
              kind="CronJob"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }
  
  if (tab === 'history') {
    return <CronJobHistoryTab namespace={row.namespace} cronJobName={row.name} />;
  }
  
  if (tab === 'nextruns') {
    return <CronJobNextRunsTab namespace={row.namespace} cronJobName={row.name} suspend={row.suspend} />;
  }
  
  if (tab === 'actions') {
    return <CronJobActionsTab namespace={row.namespace} cronJobName={row.name} suspend={row.suspend} />;
  }
  
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="CronJob"
        name={row.name}
      />
    );
  }
  
  if (tab === 'yaml') {
    return <CronJobYamlTab namespace={row.namespace} name={row.name} />;
  }
  
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="CronJob"
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
 * Complete cronjob configuration for GenericResourceTable
 */
export const cronjobConfig = {
  resourceType: 'cronjob',
  resourceKind: 'CronJob',
  columns: cronjobColumns,
  tabs: cronjobTabs,
  fetchFn: AppAPI.GetCronJobs,
  eventName: 'cronjobs:update',
  analyzeFn: AnalyzeCronJobStream,
  normalize: normalizeCronJob,
  renderPanelContent: renderCronJobPanelContent,
  onDelete: async (name, namespace) => AppAPI.DeleteResource('cronjob', namespace, name),
  title: 'Cron Jobs',
};

export default cronjobConfig;
