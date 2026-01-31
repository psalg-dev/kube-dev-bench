import { useState, useEffect, useRef } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import PersistentVolumeYamlTab from './PersistentVolumeYamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import PVBoundPVCTab from './PVBoundPVCTab';
import { showResourceOverlay } from '../../../resource-overlay';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import PVAnnotationsTab from './PVAnnotationsTab.jsx';
import PVCapacityUsageTab from './PVCapacityUsageTab.jsx';
import { showSuccess, showError } from '../../../notification';
import { AnalyzePersistentVolumeStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'accessModes', label: 'Access Modes' },
  { key: 'reclaimPolicy', label: 'Reclaim Policy' },
  { key: 'status', label: 'Status' },
  { key: 'claim', label: 'Claim' },
  { key: 'storageClass', label: 'Storage Class' },
  { key: 'volumeType', label: 'Type' },
  { key: 'age', label: 'Age' }
];

const bottomTabs = [
  { key: 'summary', label: 'Summary', countable: false },
  { key: 'boundpvc', label: 'Bound PVC', countable: false },
  { key: 'annotations', label: 'Annotations', countable: false },
  { key: 'usage', label: 'Capacity Usage', countable: false },
  { key: 'events', label: 'Events', countKey: 'events' },
  { key: 'yaml', label: 'YAML', countable: false },
  { key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(row, tab, holmesState, onAnalyze, onCancel) {
  if (tab === 'summary') {
    const quickInfoFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'accessModes', label: 'Access Modes' },
      { key: 'reclaimPolicy', label: 'Reclaim Policy' },
      { key: 'claim', label: 'Claim' },
      { key: 'storageClass', label: 'Storage Class' },
      { key: 'volumeType', label: 'Volume Type' },
      { key: 'name', label: 'PV name', type: 'break-word' }
    ];

    // Extract annotations once for reuse
    const _annotations = row.annotations || row.Annotations || row.metadata?.annotations || {};

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="pv" name={row.name} namespace={row.namespace} onDelete={async (n)=>{await AppAPI.DeleteResource('pv', '', n);}} />} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Event History at a glance */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
            <ResourceEventsTab namespace="" resourceKind="PersistentVolume" resourceName={row.name} limit={20} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'boundpvc') {
    return <PVBoundPVCTab pvName={row.name} claim={row.claim} />;
  }
  if (tab === 'annotations') {
    return <PVAnnotationsTab annotations={row.annotations || row.Annotations || row.metadata?.annotations || {}} />;
  }
  if (tab === 'usage') {
    return <PVCapacityUsageTab pvName={row.name} />;
  }
  if (tab === 'events') {
    return <ResourceEventsTab namespace="" resourceKind="PersistentVolume" resourceName={row.name} />;
  }
  if (tab === 'yaml') {
    return <PersistentVolumeYamlTab name={row.name} />;
  }
  if (tab === 'holmes') {
    const key = row.name; // PVs are cluster-scoped, no namespace
    return (
      <HolmesBottomPanel
        kind="PersistentVolume"
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

function _getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'available':
      return '#28a745'; // green
    case 'bound':
      return '#007bff'; // blue
    case 'released':
      return '#ffc107'; // yellow
    case 'failed':
      return '#dc3545'; // red
    default:
      return '#6c757d'; // gray
  }
}

export default function PersistentVolumesOverviewTable({ namespaces }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const { state: holmesState, analyze: analyzePersistentVolume, cancel: cancelHolmesAnalysis } = useHolmesAnalysis({
    kind: 'PersistentVolume',
    analyzeFn: AnalyzePersistentVolumeStream,
  });

  // Normalize PV data
  const normalize = (arr) => (arr || []).filter(Boolean).map((i) => {
    // Try to extract namespace from claim (format: namespace/name)
    let ns = '-';
    if (i.claim) {
      const parts = i.claim.split('/');
      if (parts.length === 2) ns = parts[0];
    }
    return {
      name: i.name ?? i.Name,
      namespace: i.namespace ?? i.Namespace ?? ns,
      capacity: i.capacity ?? i.Capacity ?? '-',
      accessModes: Array.isArray(i.accessModes ?? i.AccessModes) ? (i.accessModes ?? i.AccessModes).join(', ') : '-',
      reclaimPolicy: i.reclaimPolicy ?? i.ReclaimPolicy ?? '-',
      status: i.status ?? i.Status ?? '-',
      claim: i.claim ?? i.Claim ?? '-',
      storageClass: i.storageClass ?? i.StorageClass ?? '-',
      volumeType: i.volumeType ?? i.VolumeType ?? '-',
      age: i.age ?? i.Age ?? '-',
      labels: i.labels ?? i.Labels ?? i.metadata?.labels ?? {},
      annotations: i.annotations ?? i.Annotations ?? i.metadata?.annotations ?? {}
    };
  });

  // Fetch all PVs (cluster-wide)
  const fetchAllPVs = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await AppAPI.GetPersistentVolumes();
      setData(normalize(result));
    } catch (err) {
      console.error('Error fetching persistent volumes:', err);
      setError(err.toString());
      if (isInitialLoad) {
        setData([]);
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAllPVs(true); // Initial load
    intervalRef.current = setInterval(() => fetchAllPVs(false), 5000); // Subsequent refreshes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Error loading persistent volumes: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: 'var(--gh-text-muted)'
      }}>
        Loading Persistent Volumes...
      </div>
    );
  }

  const getRowActions = (row, api) => {
    const key = row.name; // PVs are cluster-scoped, no namespace
    const isAnalyzing = holmesState.loading && holmesState.key === key;
    return [
      {
        label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
        icon: '🧠',
        disabled: isAnalyzing,
        onClick: () => {
          analyzePersistentVolume(row);
          api?.openDetails?.('holmes');
        },
      },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          try {
            await AppAPI.DeleteResource('pv', '', row.name);
            showSuccess(`PersistentVolume '${row.name}' deleted`);
          } catch (err) {
            showError(`Failed to delete PersistentVolume '${row.name}': ${err?.message || err}`);
          }
        },
      },
    ];
  };

  return (
    <OverviewTableWithPanel
      title="Persistent Volumes"
      columns={columns}
      data={data}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzePersistentVolume, cancelHolmesAnalysis)}
      resourceKind="persistentvolume"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      getRowActions={getRowActions}
      onCreateResource={() => showResourceOverlay('persistentvolume', {
        namespace: namespaces && namespaces.length === 1 ? namespaces[0] : '',
        onSuccess: () => {
          fetchAllPVs(false); // Refresh the data after successful creation without showing loading state
        }
      })}
    />
  );
}
