/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/**
 * Helm Release Resource Configuration
 *
 * Configuration for GenericResourceTable to display Kubernetes Helm Releases.
 */

import * as AppAPI from '../../../wailsjs/go/main/App';
import type { app } from '../../../wailsjs/go/models';
import StatusBadge from '../../components/StatusBadge';
import QuickInfoSection, { type QuickInfoField } from '../../QuickInfoSection';
import SummaryTabHeader from '../../layout/bottompanel/SummaryTabHeader';
import YamlTab from '../../layout/bottompanel/YamlTab';
import HelmActions from '../../k8s/resources/helmreleases/HelmActions';
import HelmResourcesSummary from '../../k8s/resources/helmreleases/HelmResourcesSummary';
import HelmValuesTab from '../../k8s/resources/helmreleases/HelmValuesTab';
import HelmHistoryTab from '../../k8s/resources/helmreleases/HelmHistoryTab';
import HelmNotesTab from '../../k8s/resources/helmreleases/HelmNotesTab';
import HelmResourcesTab from '../../k8s/resources/helmreleases/HelmResourcesTab';
import { useEffect, useState } from 'react';
import type {
  RenderPanelContent,
  ResourceColumn,
  ResourceConfig,
  ResourceRow,
  ResourceTab,
} from '../../types/resourceConfigs';

/**
 * Column definitions for Helm Releases table
 */
export const helmReleasesColumns: ResourceColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'chart', label: 'Chart' },
  { key: 'chartVersion', label: 'Chart Version' },
  { key: 'appVersion', label: 'App Version' },
  { key: 'status', label: 'Status' },
  { key: 'revision', label: 'Revision' },
  { key: 'age', label: 'Age' },
];

/**
 * Tab definitions for Helm Releases bottom panel
 */
export const helmReleasesTabs: ResourceTab[] = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'values', label: 'Values', countable: false },
  { key: 'history', label: 'History', countable: false },
  { key: 'notes', label: 'Notes', countable: false },
  { key: 'resources', label: 'Resources', countable: false },
  { key: 'manifest', label: 'Manifest', countable: false },
];

/**
 * Normalize Helm release data from API response
 */
export const normalizeHelmRelease = (release: Record<string, any>): ResourceRow => {
  const data = release as app.HelmReleaseInfo;
  return {
    name: data.name ?? '',
    namespace: data.namespace ?? '',
    revision: data.revision ?? 0,
    chart: data.chart ?? '',
    chartVersion: data.chartVersion ?? '',
    appVersion: data.appVersion ?? '',
    status: data.status ?? '',
    age: data.age ?? '-',
    updated: data.updated ?? '-',
    labels: data.labels ?? {},
  };
};

/**
 * Quick info fields for Summary tab
 */
const quickInfoFields = [
  { key: 'chart', label: 'Chart' },
  { key: 'chartVersion', label: 'Chart Version' },
  { key: 'appVersion', label: 'App Version' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'revision', label: 'Revision' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'updated', label: 'Last Updated' },
  { key: 'age', label: 'Age', type: 'age' },
] satisfies QuickInfoField[];

/**
 * Render panel content for each tab
 */
export const renderHelmReleasesPanelContent: RenderPanelContent = (
  row,
  tab,
  _holmesState,
  _onAnalyze,
  _onCancel,
  _panelApi,
  _allData
) => {
  // ponytail: Helm doesn't use Holmes, ignoring unused params
  const release = row as unknown as app.HelmReleaseInfo;

  if (tab === 'summary') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={release.name}
          labels={release.labels || {}}
          actions={
            <HelmActions
              releaseName={release.name}
              namespace={release.namespace}
              chart={release.chart}
              onRefresh={() => _panelApi?.refresh?.()}
            />
          }
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={release.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <HelmResourcesSummary namespace={release.namespace} releaseName={release.name} />
            </div>
            <div style={{ width: 320, minWidth: 280, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                Release Details
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                <div style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 13, lineHeight: 1.8 }}>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Release Name:</strong> {release.name}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Chart:</strong> {release.chart}-{release.chartVersion}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>App Version:</strong> {release.appVersion || '-'}</div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Status:</strong>{' '}
                    <StatusBadge status={release.status} size="small" showDot={false} />
                  </div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Revision:</strong> {release.revision}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Namespace:</strong> {release.namespace}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Last Updated:</strong> {release.updated || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'values') {
    return <HelmValuesTab namespace={release.namespace} releaseName={release.name} />;
  }

  if (tab === 'history') {
    return <HelmHistoryTab namespace={release.namespace} releaseName={release.name} onRefresh={() => {}} />;
  }

  if (tab === 'notes') {
    return <HelmNotesTab namespace={release.namespace} releaseName={release.name} />;
  }

  if (tab === 'resources') {
    return <HelmResourcesTab namespace={release.namespace} releaseName={release.name} />;
  }

  if (tab === 'manifest') {
    return <HelmManifestTab namespace={release.namespace} releaseName={release.name} />;
  }

  return null;
};

/**
 * Helm Manifest Tab component
 */
function HelmManifestTab({ namespace, releaseName }: { namespace: string; releaseName: string }) {
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await AppAPI.GetHelmReleaseManifest(namespace, releaseName);
        if (active) setManifest(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (active) setManifest(`Error: ${message}`);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [namespace, releaseName]);

  return loading ? <div style={{ padding: 16 }}>Loading...</div> : <YamlTab content={manifest} />;
}

/**
 * Complete Helm Releases configuration for GenericResourceTable
 */
export const helmReleasesConfig: ResourceConfig = {
  resourceType: 'helmrelease',
  resourceKind: 'HelmRelease',
  columns: helmReleasesColumns,
  tabs: helmReleasesTabs,
  fetchFn: AppAPI.GetHelmReleases,
  eventName: 'helmreleases:update',
  normalize: normalizeHelmRelease,
  renderPanelContent: renderHelmReleasesPanelContent,
  title: 'Helm Releases',
  clusterScoped: false,
};

export default helmReleasesConfig;
