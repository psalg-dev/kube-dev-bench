import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import JobYamlTab from './JobYamlTab';
import JobPodsTab from './JobPodsTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import { showSuccess, showError } from '../../../notification';
import { StartJob } from '../kubeApi';
import { AnalyzeJobStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { useResourceData } from '../../../hooks/useResourceData';

const columns = [
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

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'completions',
        label: 'Completions',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'succeeded', label: 'Succeeded' },
      { key: 'active', label: 'Active' },
      { key: 'failed', label: 'Failed' },
      { key: 'duration', label: 'Duration' },
      { key: 'image', label: 'Image', type: 'break-word' },
      { key: 'name', label: 'Job name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="job" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource('job', ns, n);}} />} />
        {/* Main flex content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Logs + Event History at a glance */}
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
        onAnalyze={() => onAnalyze(row)}
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
}

function panelHeader(row) {
  return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function JobsOverviewTable({ namespaces, namespace }) {
  const { state: holmesState, analyze: analyzeJob, cancel: cancelHolmesAnalysis } = useHolmesAnalysis({
    kind: 'Job',
    analyzeFn: AnalyzeJobStream,
  });

  const { data: jobs, loading, refresh: fetchJobs } = useResourceData({
    fetchFn: AppAPI.GetJobs,
    eventName: 'jobs:update',
    namespaces,
    namespace,
    normalize: (j) => ({
      name: j.name ?? j.Name,
      namespace: j.namespace ?? j.Namespace,
      completions: j.completions ?? j.Completions ?? 0,
      succeeded: j.succeeded ?? j.Succeeded ?? 0,
      active: j.active ?? j.Active ?? 0,
      failed: j.failed ?? j.Failed ?? 0,
      age: j.age ?? j.Age ?? '-',
      duration: j.duration ?? j.Duration ?? '-',
      image: j.image ?? j.Image ?? '',
      labels: j.labels ?? j.Labels ?? j.metadata?.labels ?? {}
    }),
  });

  const getRowActions = (row, api) => {
    const key = `${row.namespace}/${row.name}`;
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzeJob(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Start',
        icon: '▶',
        onClick: async () => {
          try {
            await StartJob(row.namespace, row.name);
            showSuccess(`Job '${row.name}' started`);
          } catch (err) {
            showError(`Failed to start job '${row.name}': ${err?.message || err}`);
          }
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('job', row.namespace, row.name);
            showSuccess(`Job '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete job '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={jobs}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeJob, cancelHolmesAnalysis)}
      panelHeader={panelHeader}
      title="Jobs"
      onRefresh={fetchJobs}
      resourceKind="Job"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
