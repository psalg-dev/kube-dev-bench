import React, { useState, useEffect, useRef } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import QuickInfoSection from '../QuickInfoSection';
import { showResourceOverlay } from '../resource-overlay';

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

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--gh-border, #30363d)',
          background: 'var(--gh-bg-sidebar, #161b22)',
          color: 'var(--gh-text, #c9d1d9)'
        }}>
          Summary for {row.name}
        </div>
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
          </div>
        </div>
      </div>
    );
  }
  if (tab === 'yaml') {
    return (
      <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
        <h3>YAML</h3>
        <div style={{ color: '#6c757d', marginBottom: '10px' }}>
          YAML view for Persistent Volume details would be implemented here
        </div>
        <pre style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#333'
        }}>
          {`Name: ${row.name}
Namespace: ${row.namespace}
Capacity: ${row.capacity}
Access Modes: ${row.accessModes}
Reclaim Policy: ${row.reclaimPolicy}
Status: ${row.status}
Claim: ${row.claim}
Storage Class: ${row.storageClass}
Volume Type: ${row.volumeType}
Age: ${row.age}`}
        </pre>
      </div>
    );
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
