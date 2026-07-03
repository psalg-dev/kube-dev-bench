/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeResourceStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import SubjectsTable from '../../k8s/resources/rbac/SubjectsTable';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import YamlTab from '../../layout/bottompanel/YamlTab';
import ResourceActions from '../../components/ResourceActions';
import HolmesBottomPanel from '../../holmes/HolmesBottomPanel';
import { ResourceGraphTab } from '../../k8s/graph/ResourceGraphTab';
import type { app } from '../../../wailsjs/go/models';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
} from '../../types/resourceConfigs';

export type RoleBindingRow = ResourceRow & {
  roleRef?: { kind: string; name: string };
  roleRefLabel?: string;
  subjects?: app.Subject[];
  subjectsCount?: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
};

export const roleBindingColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'roleRefLabel', label: 'Role Ref' },
  { key: 'subjectsCount', label: 'Subjects' },
  { key: 'age', label: 'Age' },
];

export const roleBindingTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'subjects', label: 'Subjects', countKey: 'subjects' },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
  { key: 'holmes', label: 'Holmes', countable: false },
];

const normalizeLabels = (labels?: Record<string, string>): Record<string, string> => {
  if (!labels) return {};
  return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = String(value ?? '');
    return acc;
  }, {});
};

const normalizeRoleRef = (roleRef?: { kind?: string; Kind?: string; name?: string; Name?: string }) => {
  const kind = roleRef?.kind ?? roleRef?.Kind ?? 'Role';
  const name = roleRef?.name ?? roleRef?.Name ?? '-';
  return { kind, name, label: `${kind}: ${name}` };
};

export const normalizeRoleBinding = (rb: Record<string, unknown>): RoleBindingRow => {
  const roleRef = normalizeRoleRef((rb.roleRef ?? rb.RoleRef) as { kind?: string; Kind?: string; name?: string; Name?: string } | undefined);
  const subjectsRaw = (rb.subjects ?? rb.Subjects) as app.Subject[] | undefined;
  const subjects = Array.isArray(subjectsRaw) ? subjectsRaw : [];
  const meta = rb.metadata as { labels?: Record<string, string>; annotations?: Record<string, string> } | undefined;
  return {
    name: String(rb.name ?? rb.Name ?? ''),
    namespace: String(rb.namespace ?? rb.Namespace ?? ''),
    age: String(rb.age ?? rb.Age ?? '-'),
    roleRef: { kind: roleRef.kind, name: roleRef.name },
    roleRefLabel: roleRef.label,
    subjects,
    subjectsCount: subjects.length,
    labels: normalizeLabels((rb.labels ?? rb.Labels ?? meta?.labels) as Record<string, string> | undefined),
    annotations: normalizeLabels((rb.annotations ?? rb.Annotations ?? meta?.annotations) as Record<string, string> | undefined),
  };
};

const fetchRoleBindingYaml = (namespace?: string, name?: string) =>
  namespace && name ? AppAPI.GetRoleBindingYAML(namespace, name) : Promise.resolve('');

function RoleBindingYamlTab({ namespace, name }: { namespace: string; name: string }) {
  const [yaml, setYaml] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const text = await fetchRoleBindingYaml(namespace, name);
        if (mounted) setYaml(text || '');
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [namespace, name]);

  return <YamlTab content={yaml} loading={loading} error={error} />;
}

const quickInfoFields = [
  {
    key: 'roleRefLabel',
    label: 'Role Ref',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, unknown>) => (data as RoleBindingRow).age,
    },
  },
  { key: 'subjectsCount', label: 'Subjects' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'name', label: 'Role binding name', type: 'break-word' },
  { key: 'labels', label: 'Labels', type: 'labels' },
] satisfies QuickInfoField[];

export const renderRoleBindingPanelContent: RenderPanelContent = (
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
          labels={row.labels}
          actions={
            <ResourceActions
              resourceType="rolebinding"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n: string, ns?: string) => { await AppAPI.DeleteResource('rolebinding', ns ?? '', n); }}
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
              kind="RoleBinding"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'subjects') {
    return <SubjectsTable subjects={(row as RoleBindingRow).subjects || []} />;
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="RoleBinding"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    return <RoleBindingYamlTab namespace={row.namespace} name={row.name} />;
  }

  if (tab === 'relationships') {
    return <ResourceGraphTab namespace={row.namespace} kind="RoleBinding" name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="RoleBinding"
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

export const roleBindingConfig: ResourceConfig = {
  resourceType: 'rolebinding',
  resourceKind: 'RoleBinding',
  columns: roleBindingColumns,
  tabs: roleBindingTabs,
  fetchFn: AppAPI.GetRoleBindings,
  eventName: 'rolebindings:update',
  analyzeFn: (namespace: string, name: string, streamId: string) => AnalyzeResourceStream('RoleBinding', namespace, name, streamId),
  normalize: normalizeRoleBinding,
  renderPanelContent: renderRoleBindingPanelContent,
  onDelete: async (name: string, namespace?: string) => AppAPI.DeleteResource('rolebinding', namespace ?? '', name),
  title: 'Role Bindings',
};

export default roleBindingConfig;
