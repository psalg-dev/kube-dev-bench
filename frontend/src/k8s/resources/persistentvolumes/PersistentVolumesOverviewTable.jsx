import React, { useState, useEffect, useRef } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import PVBoundPVCTab from './PVBoundPVCTab';
import { showResourceOverlay } from '../../../resource-overlay';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';
import PVAnnotationsTab from './PVAnnotationsTab.jsx';
import PVCapacityUsageTab from './PVCapacityUsageTab.jsx';

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
  { key: 'summary', label: 'Summary' },
  { key: 'boundpvc', label: 'Bound PVC' },
  { key: 'annotations', label: 'Annotations' },
  { key: 'usage', label: 'Capacity Usage' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
];

function renderPanelContent(row, tab) {
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
    const annotations = row.annotations || row.Annotations || row.metadata?.annotations || {};

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="pv" name={row.name} namespace={row.namespace} onDelete={async (n)=>{await AppAPI.DeleteResource("pv", "", n);}} />} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Right side content area for additional information */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Persistent Volume Details</div>
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
              <strong>Status:</strong> {row.status || '-'}<br />
              <strong>Capacity:</strong> {row.capacity || '-'}<br />
              <strong>Access Modes:</strong> {row.accessModes || '-'}<br />
              <strong>Reclaim Policy:</strong> {row.reclaimPolicy || '-'}<br />
              <strong>Claim:</strong> {row.claim || '-'}<br />
              <strong>Storage Class:</strong> {row.storageClass || '-'}
            </div>
            {annotations && Object.keys(annotations).length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Annotations</div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  maxHeight: 180,
                  overflowY: 'auto',
                  paddingRight: 4,
                  fontSize: 12,
                  scrollbarWidth: 'thin'
                }}>
                  {Object.entries(annotations).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--gh-text-muted, #8b949e)', minWidth: 200, wordBreak: 'break-all' }}>{k}:</span>
                      <span style={{ marginLeft: 4, wordBreak: 'break-all', flex: 1 }}>{v || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(!annotations || Object.keys(annotations).length === 0) && (
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--gh-text-muted, #8b949e)' }}>
                No annotations
              </div>
            )}
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
    const yamlContent = `apiVersion: v1
kind: PersistentVolume
metadata:
  name: ${row.name}
spec:
  capacity:
    storage: ${row.capacity}
  accessModes:
  ${row.accessModes ? `- ${row.accessModes}` : '- ReadWriteOnce'}
  persistentVolumeReclaimPolicy: ${row.reclaimPolicy || 'Retain'}
  storageClassName: ${row.storageClass || 'default'}
  hostPath:
    path: /mnt/data`;

    return <YamlTab content={yamlContent} />;
  }
  return null;
}

function getStatusColor(status) {
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

  return (
    <OverviewTableWithPanel
      title="Persistent Volumes"
      columns={columns}
      data={data}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      resourceKind="persistentvolume"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      onCreateResource={() => showResourceOverlay('persistentvolume', {
        namespace: namespaces && namespaces.length === 1 ? namespaces[0] : '',
        onSuccess: () => {
          fetchAllPVs(false); // Refresh the data after successful creation without showing loading state
        }
      })}
    />
  );
}
