/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * Service Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes Services.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeServiceStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import ServiceEndpointsTab from '../../k8s/resources/services/ServiceEndpointsTab';
import ServiceYamlTab from '../../k8s/resources/services/ServiceYamlTab';
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
 * Column definitions for Services table
 */
export const serviceColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'clusterIP', label: 'Cluster IP' },
  { key: 'ports', label: 'Ports' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for Services bottom panel
 */
export const serviceTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'endpoints', label: 'Endpoints', countKey: 'endpoints' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize service data from API response
 */
export const normalizeService = (svc: Record<string, any>): ResourceRow => ({
  name: svc.name ?? svc.Name,
  namespace: svc.namespace ?? svc.Namespace,
  type: svc.type ?? svc.Type ?? 'ClusterIP',
  clusterIP: svc.clusterIP ?? svc.ClusterIP ?? '-',
  ports: svc.ports ?? svc.Ports ?? '-',
  age: svc.age ?? svc.Age ?? '-',
  labels: svc.labels ?? svc.Labels ?? svc.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  { key: 'name', label: 'Service name', type: 'break-word' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'type', label: 'Type' },
  { key: 'clusterIP', label: 'Cluster IP' },
  { key: 'ports', label: 'Ports' },
  { key: 'age', label: 'Age' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderServicePanelContent: RenderPanelContent = (
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
              resourceType="service"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n: string, ns?: string) => { await AppAPIAny.DeleteResource('service', ns ?? '', n); }}
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
          <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
            <ResourceEventsTab
              namespace={row.namespace}
              kind="Service"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'endpoints') {
    return <ServiceEndpointsTab namespace={row.namespace} serviceName={row.name} />;
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Service"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    return <ServiceYamlTab namespace={row.namespace} name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Service"
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
 * Complete service configuration for GenericResourceTable
 */
export const serviceConfig: ResourceConfig = {
  resourceType: 'service',
  resourceKind: 'Service',
  columns: serviceColumns,
  tabs: serviceTabs,
  fetchFn: AppAPI.GetServices,
  eventName: 'services:update',
  analyzeFn: AnalyzeServiceStream,
  normalize: normalizeService,
  renderPanelContent: renderServicePanelContent,
  onDelete: async (name: string, namespace?: string) => AppAPIAny.DeleteResource('service', namespace ?? '', name),
  title: 'Services',
};

export default serviceConfig;
