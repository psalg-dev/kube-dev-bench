import { useEffect, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import HelmHistoryTab from './HelmHistoryTab.jsx';
import HelmValuesTab from './HelmValuesTab.jsx';
import HelmNotesTab from './HelmNotesTab.jsx';
import HelmActions from './HelmActions.jsx';
import HelmResourcesTab from './HelmResourcesTab.jsx';
import HelmResourcesSummary from './HelmResourcesSummary.jsx';
import { showSuccess, showError } from '../../../notification.js';
import StatusBadge from '../../../components/StatusBadge.jsx';

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

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    const quickInfoFields = [
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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
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
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            color: 'var(--gh-text, #c9d1d9)',
          }}
        >
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Resources + Release Details */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                position: 'relative',
              }}
            >
              <HelmResourcesSummary
                namespace={row.namespace}
                releaseName={row.name}
              />
            </div>
            <div
              style={{
                width: 320,
                minWidth: 280,
                minHeight: 0,
                borderLeft: '1px solid var(--gh-border, #30363d)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: 44,
                  padding: '0 12px',
                  borderBottom: '1px solid var(--gh-border, #30363d)',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 600,
                }}
              >
                Release Details
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                <div
                  style={{
                    color: 'var(--gh-text-muted, #8b949e)',
                    fontSize: 13,
                    lineHeight: 1.8,
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      Release Name:
                    </strong>{' '}
                    {row.name}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      Chart:
                    </strong>{' '}
                    {row.chart}-{row.chartVersion}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      App Version:
                    </strong>{' '}
                    {row.appVersion || '-'}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      Status:
                    </strong>{' '}
                    <StatusBadge
                      status={row.status}
                      size="small"
                      showDot={false}
                    />
                  </div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      Revision:
                    </strong>{' '}
                    {row.revision}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      Namespace:
                    </strong>{' '}
                    {row.namespace}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
                      Last Updated:
                    </strong>{' '}
                    {row.updated || '-'}
                  </div>
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
    return (
      <HelmHistoryTab
        namespace={row.namespace}
        releaseName={row.name}
        onRefresh={onRefresh}
      />
    );
  }
  if (tab === 'notes') {
    return <HelmNotesTab namespace={row.namespace} releaseName={row.name} />;
  }
  if (tab === 'resources') {
    return (
      <HelmResourcesTab namespace={row.namespace} releaseName={row.name} />
    );
  }
  if (tab === 'manifest') {
    return <HelmManifestTab namespace={row.namespace} releaseName={row.name} />;
  }
  return null;
}

function HelmManifestTab({ namespace, releaseName }) {
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    AppAPI.GetHelmReleaseManifest(namespace, releaseName)
      .then(setManifest)
      .catch((err) => setManifest(`Error loading manifest: ${err}`))
      .finally(() => setLoading(false));
  }, [namespace, releaseName]);

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
        Loading manifest...
      </div>
    );
  }

  return <YamlTab content={manifest} />;
}

export default function HelmReleasesOverviewTable({ namespaces, namespace }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    const nsArr =
      Array.isArray(namespaces) && namespaces.length > 0
        ? namespaces
        : namespace
          ? [namespace]
          : [];
    if (nsArr.length === 0) return;

    const normalize = (arr) =>
      (arr || []).filter(Boolean).map((r) => ({
        name: r.name ?? r.Name,
        namespace: r.namespace ?? r.Namespace,
        revision: r.revision ?? r.Revision ?? 0,
        chart: r.chart ?? r.Chart ?? '',
        chartVersion: r.chartVersion ?? r.ChartVersion ?? '',
        appVersion: r.appVersion ?? r.AppVersion ?? '',
        status: r.status ?? r.Status ?? '',
        age: r.age ?? r.Age ?? '-',
        updated: r.updated ?? r.Updated ?? '-',
        labels: r.labels ?? r.Labels ?? {},
      }));

    const fetchReleases = async () => {
      try {
        setLoading(true);
        const lists = await Promise.all(
          nsArr.map((ns) => AppAPI.GetHelmReleases(ns).catch(() => [])),
        );
        const flat = lists.flat();
        setReleases(normalize(flat));
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
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const norm = arr.map((r) => ({
          name: r.name ?? r.Name,
          namespace: r.namespace ?? r.Namespace,
          revision: r.revision ?? r.Revision ?? 0,
          chart: r.chart ?? r.Chart ?? '',
          chartVersion: r.chartVersion ?? r.ChartVersion ?? '',
          appVersion: r.appVersion ?? r.AppVersion ?? '',
          status: r.status ?? r.Status ?? '',
          age: r.age ?? r.Age ?? '-',
          updated: r.updated ?? r.Updated ?? '-',
          labels: r.labels ?? r.Labels ?? {},
        }));
        setReleases(norm);
      } catch (_e) {
        setReleases([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('helmreleases:update', onUpdate);
    return () => {
      try {
        EventsOff('helmreleases:update');
      } catch (_) {}
    };
  }, []);

  const getRowActions = (row, _api) => [
    {
      label: 'Rollback',
      icon: '↩️',
      onClick: async () => {
        try {
          const history = await AppAPI.GetHelmReleaseHistory(
            row.namespace,
            row.name,
          );
          const revisions = (history || [])
            .map((h) => h.revision)
            .filter((r) => Number.isInteger(r));
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

          if (
            !Number.isInteger(targetRevision) ||
            !candidates.includes(targetRevision)
          ) {
            showError(`Invalid revision: ${input}`);
            return;
          }

          if (
            !window.confirm(
              `Rollback "${row.name}" to revision ${targetRevision}?`,
            )
          ) {
            return;
          }

          await AppAPI.RollbackHelmRelease(
            row.namespace,
            row.name,
            targetRevision,
          );
          showSuccess(
            `Rolled back "${row.name}" to revision ${targetRevision}`,
          );
          handleRefresh();
        } catch (err) {
          showError(`Rollback failed: ${err?.message || err}`);
        }
      },
    },
    {
      label: 'Uninstall',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        if (
          !window.confirm(
            `Are you sure you want to uninstall "${row.name}" from namespace "${row.namespace}"?`,
          )
        ) {
          return;
        }
        try {
          await AppAPI.UninstallHelmRelease(row.namespace, row.name);
          showSuccess(`Helm release '${row.name}' uninstalled`);
          handleRefresh();
        } catch (err) {
          showError(
            `Failed to uninstall Helm release '${row.name}': ${err?.message || err}`,
          );
        }
      },
    },
  ];

  return (
    <OverviewTableWithPanel
      columns={columns}
      data={releases}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) =>
        renderPanelContent(row, tab, handleRefresh)
      }
      panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
      title="Helm Releases"
      loading={loading}
      resourceKind="HelmRelease"
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
