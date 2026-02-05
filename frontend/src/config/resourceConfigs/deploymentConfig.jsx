/**
 * Deployment Resource Configuration
 * 
 * Configuration for GenericResourceTable to display Kubernetes Deployments.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeDeploymentStream } from '../../holmes/holmesApi';
import QuickInfoSection from '../../QuickInfoSection';
import YamlTab from '../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import DeploymentPodsTab from '../../k8s/resources/deployments/DeploymentPodsTab';
import DeploymentRolloutTab from '../../k8s/resources/deployments/DeploymentRolloutTab';
import AggregateLogsTab from '../../components/AggregateLogsTab';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';

/**
 * Column definitions for Deployments table
 */
export const deploymentColumns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'replicas', label: 'Replicas' },
  { key: 'ready', label: 'Ready' },
  { key: 'available', label: 'Available' },
  { key: 'age', label: 'Age' },
  { key: 'image', label: 'Image' },
];

/**
 * Tab definitions for Deployments bottom panel
 */
export const deploymentTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'pods', label: 'Pods', countKey: 'pods' },
  { key: 'rollout', label: 'Rollout', countable: false },
  { key: 'logs', label: 'Logs', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

/**
 * Normalize deployment data from API response
 */
export const normalizeDeployment = (d) => ({
  name: d.name ?? d.Name,
  namespace: d.namespace ?? d.Namespace,
  replicas: d.replicas ?? d.Replicas ?? 0,
  ready: d.ready ?? d.Ready ?? 0,
  available: d.available ?? d.Available ?? 0,
  age: d.age ?? d.Age ?? '-',
  image: d.image ?? d.Image ?? '',
  labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {},
});

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  {
    key: 'replicas',
    label: 'Replicas',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data) => data.created || data.age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'ready', label: 'Ready' },
  { key: 'available', label: 'Available' },
  { key: 'image', label: 'Image', type: 'break-word' },
  { key: 'name', label: 'Deployment name', type: 'break-word' },
];

/**
 * Render panel content for each tab
 */
export const renderDeploymentPanelContent = (row, tab, holmesState, onAnalyze, onCancel) => {
  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || row.Labels || row.metadata?.labels}
          actions={
            <ResourceActions
              resourceType="deployment"
              name={row.name}
              namespace={row.namespace}
              replicaCount={row.replicas}
              onRestart={async (n, ns) => { await AppAPI.RestartDeployment(ns, n); }}
              onDelete={async (n, ns) => { await AppAPI.DeleteResource('deployment', ns, n); }}
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
                loadLogs={() => AppAPI.GetDeploymentLogs(row.namespace, row.name)}
              />
            </div>
            <div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
              <ResourceEventsTab
                namespace={row.namespace}
                kind="Deployment"
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
    return <DeploymentPodsTab namespace={row.namespace} deploymentName={row.name} />;
  }
  
  if (tab === 'rollout') {
    return <DeploymentRolloutTab namespace={row.namespace} deploymentName={row.name} />;
  }
  
  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Deployment Logs"
        reloadKey={`${row.namespace}/${row.name}`}
        loadLogs={() => AppAPI.GetDeploymentLogs(row.namespace, row.name)}
      />
    );
  }
  
  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Deployment"
        name={row.name}
      />
    );
  }
  
  if (tab === 'yaml') {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  replicas: ${row.replicas}
  selector:
    matchLabels:
      app: ${row.name}
  template:
    metadata:
      labels:
        app: ${row.name}
    spec:
      containers:
      - name: ${row.name}
        image: ${row.image}`;

    return <YamlTab content={yamlContent} />;
  }
  
  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Deployment"
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
 * Complete deployment configuration for GenericResourceTable
 */
export const deploymentConfig = {
  resourceType: 'deployment',
  resourceKind: 'Deployment',
  columns: deploymentColumns,
  tabs: deploymentTabs,
  fetchFn: AppAPI.GetDeployments,
  eventName: 'deployments:update',
  analyzeFn: AnalyzeDeploymentStream,
  normalize: normalizeDeployment,
  renderPanelContent: renderDeploymentPanelContent,
  onRestart: async (name, namespace) => AppAPI.RestartDeployment(namespace, name),
  onDelete: async (name, namespace) => AppAPI.DeleteResource('deployment', namespace, name),
  onScale: async (namespace, name, replicas) => AppAPI.ScaleDeployment(namespace, name, replicas),
  title: 'Deployments',
};

export default deploymentConfig;
