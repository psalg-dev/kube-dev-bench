import React, { useEffect, useState } from 'react';
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
  { key: 'manifest', label: 'Manifest' },
];

function getStatusColor(status) {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'deployed') return '#2ea44f';
  if (statusLower === 'failed') return '#d73a49';
  if (statusLower === 'pending' || statusLower.includes('pending')) return '#e6b800';
  if (statusLower === 'uninstalling') return '#e6b800';
  if (statusLower === 'superseded') return '#9aa0a6';
  return '#9aa0a6';
}

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
        render: (val) => (
          <span style={{ color: getStatusColor(val), fontWeight: 600 }}>{val}</span>
        )
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
          <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Release Details</div>
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
              <strong>Release Name:</strong> {row.name}<br />
              <strong>Chart:</strong> {row.chart}-{row.chartVersion}<br />
              <strong>App Version:</strong> {row.appVersion || '-'}<br />
              <strong>Status:</strong>{' '}
              <span style={{ color: getStatusColor(row.status) }}>{row.status}</span><br />
              <strong>Revision:</strong> {row.revision}
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
    return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading manifest...</div>;
  }

  return <YamlTab content={manifest} />;
}

export default function HelmReleasesOverviewTable({ namespaces, namespace }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;

    const normalize = (arr) => (arr || []).filter(Boolean).map(r => ({
      name: r.name ?? r.Name,
      namespace: r.namespace ?? r.Namespace,
      revision: r.revision ?? r.Revision ?? 0,
      chart: r.chart ?? r.Chart ?? '',
      chartVersion: r.chartVersion ?? r.ChartVersion ?? '',
      appVersion: r.appVersion ?? r.AppVersion ?? '',
      status: r.status ?? r.Status ?? '',
      age: r.age ?? r.Age ?? '-',
      updated: r.updated ?? r.Updated ?? '-',
      labels: r.labels ?? r.Labels ?? {}
    }));

    const fetchReleases = async () => {
      try {
        setLoading(true);
        const lists = await Promise.all(nsArr.map(ns => AppAPI.GetHelmReleases(ns).catch(() => [])));
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
        const norm = arr.map(r => ({
          name: r.name ?? r.Name,
          namespace: r.namespace ?? r.Namespace,
          revision: r.revision ?? r.Revision ?? 0,
          chart: r.chart ?? r.Chart ?? '',
          chartVersion: r.chartVersion ?? r.ChartVersion ?? '',
          appVersion: r.appVersion ?? r.AppVersion ?? '',
          status: r.status ?? r.Status ?? '',
          age: r.age ?? r.Age ?? '-',
          updated: r.updated ?? r.Updated ?? '-',
          labels: r.labels ?? r.Labels ?? {}
        }));
        setReleases(norm);
      } catch (e) {
        setReleases([]);
      } finally {
        setLoading(false);
      }
    };
    EventsOn('helmreleases:update', onUpdate);
    return () => {
      try { EventsOff('helmreleases:update'); } catch (_) {}
    };
  }, []);

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
    />
  );
}
