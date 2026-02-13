import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import { EventsOff, EventsOn } from '../../../../wailsjs/runtime';
import StatusBadge from '../../../components/StatusBadge';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { showError, showSuccess } from '../../../notification';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import HelmActions from './HelmActions';
import HelmHistoryTab from './HelmHistoryTab';
import HelmNotesTab from './HelmNotesTab';
import HelmResourcesSummary from './HelmResourcesSummary';
import HelmResourcesTab from './HelmResourcesTab';
import HelmValuesTab from './HelmValuesTab';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'chart', label: 'Chart' },
  { key: 'chartVersion', label: 'Chart Version' },
  { key: 'appVersion', label: 'App Version' },
  { key: 'status', label: 'Status' },
  { key: 'revision', label: 'Revision' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'values', label: 'Values' },
  { key: 'history', label: 'History' },
  { key: 'notes', label: 'Notes' },
  { key: 'resources', label: 'Resources' },
  { key: 'manifest', label: 'Manifest' },
];

type HelmReleaseRow = {
  name: string;
  namespace: string;
  revision: number;
  chart: string;
  chartVersion: string;
  appVersion: string;
  status: string;
  age: string;
  updated: string;
  labels: Record<string, string>;
};

type HelmReleaseInfoRaw = app.HelmReleaseInfo & {
  Name?: string;
  Namespace?: string;
  Revision?: number;
  Chart?: string;
  ChartVersion?: string;
  AppVersion?: string;
  Status?: string;
  Age?: string;
  Updated?: string;
  Labels?: Record<string, string>;
};

function renderPanelContent(row: HelmReleaseRow, tab: string, onRefresh: () => void) {
  if (tab === 'summary') {
    const quickInfoFields: QuickInfoField[] = [
      { key: 'chart', label: 'Chart' },
      { key: 'chartVersion', label: 'Chart Version' },
      { key: 'appVersion', label: 'App Version' },
      { key: 'namespace', label: 'Namespace' },
      { key: 'revision', label: 'Revision' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
      },
      { key: 'updated', label: 'Last Updated' },
      { key: 'age', label: 'Age', type: 'age' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          labels={row.labels || {}}
          actions={
            <HelmActions
              releaseName={row.name}
              namespace={row.namespace}
              chart={row.chart}
              onRefresh={onRefresh}
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
          {/* Resources + Release Details */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <HelmResourcesSummary namespace={row.namespace} releaseName={row.name} />
            </div>
            <div style={{ width: 320, minWidth: 280, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                Release Details
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                <div style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 13, lineHeight: 1.8 }}>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Release Name:</strong> {row.name}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Chart:</strong> {row.chart}-{row.chartVersion}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>App Version:</strong> {row.appVersion || '-'}</div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Status:</strong>{' '}
                    <StatusBadge status={row.status} size="small" showDot={false} />
                  </div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Revision:</strong> {row.revision}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Namespace:</strong> {row.namespace}</div>
                  <div><strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Last Updated:</strong> {row.updated || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'values') {
    return <HelmValuesTab namespace={row.namespace} releaseName={row.name} />;
  }
  if (tab === 'history') {
    return <HelmHistoryTab namespace={row.namespace} releaseName={row.name} onRefresh={onRefresh} />;
  }
  if (tab === 'notes') {
    return <HelmNotesTab namespace={row.namespace} releaseName={row.name} />;
  }
  if (tab === 'resources') {
    return <HelmResourcesTab namespace={row.namespace} releaseName={row.name} />;
  }
  if (tab === 'manifest') {
    return <HelmManifestTab namespace={row.namespace} releaseName={row.name} />;
  }
  return null;
}

type HelmManifestTabProps = {
  namespace?: string;
  releaseName?: string;
};

function HelmManifestTab({ namespace, releaseName }: HelmManifestTabProps) {
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadManifest = async () => {
      if (active) {
        setLoading(true);
      }
      try {
        const data = await AppAPI.GetHelmReleaseManifest(namespace ?? '', releaseName ?? '');
        if (active) {
          setManifest(data);
        }
      } catch (err: unknown) {
        if (active) {
          const message = err instanceof Error ? err.message : String(err);
          setManifest(`Error loading manifest: ${message}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadManifest();
    return () => {
      active = false;
    };
  }, [namespace, releaseName]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading manifest...</div>;
  }

  return <YamlTab content={manifest} />;
}

type HelmReleasesOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

const normalizeRelease = (release: HelmReleaseInfoRaw): HelmReleaseRow => ({
  name: release.name ?? release.Name ?? '',
  namespace: release.namespace ?? release.Namespace ?? '',
  revision: release.revision ?? release.Revision ?? 0,
  chart: release.chart ?? release.Chart ?? '',
  chartVersion: release.chartVersion ?? release.ChartVersion ?? '',
  appVersion: release.appVersion ?? release.AppVersion ?? '',
  status: release.status ?? release.Status ?? '',
  age: release.age ?? release.Age ?? '-',
  updated: release.updated ?? release.Updated ?? '-',
  labels: release.labels ?? release.Labels ?? {},
});

const normalizeReleases = (arr: HelmReleaseInfoRaw[] | null | undefined): HelmReleaseRow[] =>
  (arr || []).filter(Boolean).map(normalizeRelease);

export default function HelmReleasesOverviewTable({ namespaces, namespace }: HelmReleasesOverviewTableProps) {
  const [releases, setReleases] = useState<HelmReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;

    const fetchReleases = async () => {
      try {
        setLoading(true);
        const lists = await Promise.all(
          nsArr.map((ns) => AppAPI.GetHelmReleases(ns).catch(() => [] as app.HelmReleaseInfo[]))
        );
        const flat = lists.flat();
        setReleases(normalizeReleases(flat));
      } catch (error) {
        console.error('Failed to fetch helm releases:', error);
        setReleases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReleases();
  }, [namespaces, namespace, refreshKey]);

  // Subscribe to live updates
  useEffect(() => {
    const onUpdate = (list: HelmReleaseInfoRaw[] | null | undefined) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        setReleases(normalizeReleases(arr));
      } catch {
        setReleases([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('helmreleases:update', onUpdate);
    return () => {
      try { EventsOff('helmreleases:update'); } catch {}
    };
  }, []);

  const getRowActions = (row: HelmReleaseRow) => [
    {
      label: 'Rollback',
      icon: '↩️',
      onClick: async () => {
        try {
          const history = await AppAPI.GetHelmReleaseHistory(row.namespace, row.name);
          const revisions = (history || []).map((h) => h.revision).filter((r) => Number.isInteger(r));
          if (revisions.length <= 1) {
            showError(`No previous revision available for '${row.name}'`);
            return;
          }

          const currentRevision = revisions[0];
          const candidates = revisions.filter((r) => r !== currentRevision);
          if (candidates.length === 0) {
            showError(`No previous revision available for '${row.name}'`);
            return;
          }

          const promptText = `Enter revision to rollback "${row.name}" (current: ${currentRevision}). Available: ${candidates.join(', ')}`;
          const input = window.prompt(promptText, String(candidates[0]));
          if (input === null || input === '') return;
          const targetRevision = Number(input);

          if (!Number.isInteger(targetRevision) || !candidates.includes(targetRevision)) {
            showError(`Invalid revision: ${input}`);
            return;
          }

          if (!window.confirm(`Rollback "${row.name}" to revision ${targetRevision}?`)) {
            return;
          }

          await AppAPI.RollbackHelmRelease(row.namespace, row.name, targetRevision);
          showSuccess(`Rolled back "${row.name}" to revision ${targetRevision}`);
          handleRefresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Rollback failed: ${message}`);
        }
      },
    },
    {
      label: 'Uninstall',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        if (!window.confirm(`Are you sure you want to uninstall "${row.name}" from namespace "${row.namespace}"?`)) {
          return;
        }
        try {
          await AppAPI.UninstallHelmRelease(row.namespace, row.name);
          showSuccess(`Helm release '${row.name}' uninstalled`);
          handleRefresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to uninstall Helm release '${row.name}': ${message}`);
        }
      },
    },
  ];

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={releases}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, handleRefresh)}
      panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
      title="Helm Releases"
      loading={loading}
      resourceKind="HelmRelease"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}

