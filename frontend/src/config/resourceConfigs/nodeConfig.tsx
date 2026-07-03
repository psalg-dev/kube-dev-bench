/* eslint-disable react-refresh/only-export-components */
import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeNodeStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import { ResourceGraphTab } from '../../k8s/graph/ResourceGraphTab';
import NodeConditionsTab from '../../k8s/resources/nodes/NodeConditionsTab';
import NodePodsTab from '../../k8s/resources/nodes/NodePodsTab';
import NodeResourcesTab from '../../k8s/resources/nodes/NodeResourcesTab';
import NodeYamlTab from '../../k8s/resources/nodes/NodeYamlTab';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceTab,
} from '../../types/resourceConfigs';

export const nodeColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  {
    key: 'roles',
    label: 'Roles',
    cell: ({ getValue }: { getValue: () => unknown }) => {
      const value = getValue();
      return Array.isArray(value) ? value.join(', ') : '-';
    },
  },
  { key: 'version', label: 'Kubelet' },
  { key: 'internalIP', label: 'Internal IP' },
  { key: 'allocatableCPU', label: 'CPU' },
  { key: 'allocatableMemory', label: 'Memory' },
  { key: 'age', label: 'Age' },
];

export const nodeTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'conditions', label: 'Conditions', countable: false },
  { key: 'pods', label: 'Pods on Node', countable: false },
  { key: 'resources', label: 'Resources', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

const quickInfoFields = [
  {
    key: 'status',
    label: 'Status',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, unknown>) => data.age,
    },
  },
  {
    key: 'roles',
    label: 'Roles',
    getValue: (data: Record<string, unknown>) => (Array.isArray(data.roles) ? data.roles.join(', ') : '-'),
  },
  { key: 'version', label: 'Kubelet Version' },
  { key: 'internalIP', label: 'Internal IP' },
  { key: 'externalIP', label: 'External IP' },
  { key: 'name', label: 'Node name', type: 'break-word' },
] satisfies QuickInfoField[];

export const renderNodePanelContent: RenderPanelContent = (
  row,
  tab,
  holmesState,
  onAnalyze,
  onCancel
) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || {}} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab namespace="" kind="Node" name={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'conditions') {
    return <NodeConditionsTab node={row} />;
  }

  if (tab === 'pods') {
    return <NodePodsTab nodeName={row.name} />;
  }

  if (tab === 'resources') {
    return <NodeResourcesTab node={row} />;
  }

  if (tab === 'events') {
    return <ResourceEventsTab namespace="" kind="Node" name={row.name} />;
  }

  if (tab === 'yaml') {
    return <NodeYamlTab name={row.name} />;
  }

  if (tab === 'relationships') {
    return <ResourceGraphTab namespace="" kind="Node" name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = row.name;
    return (
      <HolmesBottomPanel
        kind="Node"
        name={row.name}
        onAnalyze={() => onAnalyze(row.name)}
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

export const nodeConfig: ResourceConfig = {
  resourceType: 'node',
  resourceKind: 'Node',
  columns: nodeColumns,
  tabs: nodeTabs,
  fetchFn: AppAPI.GetNodes,
  eventName: 'nodes:update',
  analyzeFn: AnalyzeNodeStream,
  clusterScoped: true,
  renderPanelContent: renderNodePanelContent,
  title: 'Nodes',
};

export default nodeConfig;
