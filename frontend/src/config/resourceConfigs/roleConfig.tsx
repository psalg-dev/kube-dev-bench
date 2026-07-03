/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import * as AppAPI from '../../../wailsjs/go/main/App';
import { AnalyzeResourceStream } from '../../holmes/holmesApi';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import ResourceEventsTab from '../../components/ResourceEventsTab';
import PolicyRulesTable from '../../k8s/resources/rbac/PolicyRulesTable';
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

export type RoleRow = ResourceRow & {
  ruleCount?: number;
  rules?: app.PolicyRule[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
};

export const roleColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'ruleCount', label: 'Rules' },
  { key: 'age', label: 'Age' },
];

export const roleTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'rules', label: 'Rules', countKey: 'rules' },
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

export const normalizeRole = (r: Record<string, unknown>): RoleRow => {
  const rules = (r.rules ?? r.Rules) as app.PolicyRule[] | undefined;
  const meta = r.metadata as { labels?: Record<string, string>; annotations?: Record<string, string> } | undefined;
  return {
    name: String(r.name ?? r.Name ?? ''),
    namespace: String(r.namespace ?? r.Namespace ?? ''),
    age: String(r.age ?? r.Age ?? '-'),
    ruleCount: Array.isArray(rules) ? rules.length : 0,
    labels: normalizeLabels((r.labels ?? r.Labels ?? meta?.labels) as Record<string, string> | undefined),
    annotations: normalizeLabels((r.annotations ?? r.Annotations ?? meta?.annotations) as Record<string, string> | undefined),
    rules: Array.isArray(rules) ? rules : [],
  };
};

const fetchRoleYaml = (namespace?: string, name?: string) =>
  namespace && name ? AppAPI.GetRoleYAML(namespace, name) : Promise.resolve('');

function RoleYamlTab({ namespace, name }: { namespace: string; name: string }) {
  const [yaml, setYaml] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const text = await fetchRoleYaml(namespace, name);
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
    key: 'ruleCount',
    label: 'Rules',
    layout: 'flex',
    rightField: {
      key: 'age',
      label: 'Age',
      type: 'age',
      getValue: (data: Record<string, unknown>) => (data as RoleRow).age,
    },
  },
  { key: 'namespace', label: 'Namespace' },
  { key: 'name', label: 'Role name', type: 'break-word' },
  { key: 'labels', label: 'Labels', type: 'labels' },
] satisfies QuickInfoField[];

export const renderRolePanelContent: RenderPanelContent = (
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
              resourceType="role"
              name={row.name}
              namespace={row.namespace}
              onDelete={async (n: string, ns?: string) => { await AppAPI.DeleteResource('role', ns ?? '', n); }}
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
              kind="Role"
              name={row.name}
              limit={20}
            />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'rules') {
    return <PolicyRulesTable rules={(row as RoleRow).rules || []} />;
  }

  if (tab === 'events') {
    return (
      <ResourceEventsTab
        namespace={row.namespace}
        kind="Role"
        name={row.name}
      />
    );
  }

  if (tab === 'yaml') {
    return <RoleYamlTab namespace={row.namespace} name={row.name} />;
  }

  if (tab === 'relationships') {
    return <ResourceGraphTab namespace={row.namespace} kind="Role" name={row.name} />;
  }

  if (tab === 'holmes') {
    const key = `${row.namespace}/${row.name}`;
    return (
      <HolmesBottomPanel
        kind="Role"
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

export const roleConfig: ResourceConfig = {
  resourceType: 'role',
  resourceKind: 'Role',
  columns: roleColumns,
  tabs: roleTabs,
  fetchFn: AppAPI.GetRoles,
  eventName: 'roles:update',
  analyzeFn: (namespace: string, name: string, streamId: string) => AnalyzeResourceStream('Role', namespace, name, streamId),
  normalize: normalizeRole,
  renderPanelContent: renderRolePanelContent,
  onDelete: async (name: string, namespace?: string) => AppAPI.DeleteResource('role', namespace ?? '', name),
  title: 'Roles',
};

export default roleConfig;
