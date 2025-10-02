import React, { useState, useEffect, useRef } from 'react';
import { GetPersistentVolumes } from '../../wailsjs/go/main/App';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import { showResourceOverlay } from '../resource-overlay';

const columns = [
  { key: 'name', label: 'Name' },
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
    return (
      <div style={{ padding: '20px' }}>
        <h3>Persistent Volume Summary</h3>
        <p><b>Name:</b> {row.name}</p>
        <p><b>Capacity:</b> {row.capacity}</p>
        <p><b>Access Modes:</b> {row.accessModes}</p>
        <p><b>Reclaim Policy:</b> {row.reclaimPolicy}</p>
        <p><b>Status:</b> <span style={{ color: getStatusColor(row.status) }}>{row.status}</span></p>
        <p><b>Claim:</b> {row.claim === '-' ? 'Unbound' : row.claim}</p>
        <p><b>Storage Class:</b> {row.storageClass}</p>
        <p><b>Volume Type:</b> {row.volumeType}</p>
        <p><b>Age:</b> {row.age}</p>
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

function PersistentVolumesOverviewTable({ namespace }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const persistentVolumes = await GetPersistentVolumes();
      setData(persistentVolumes || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching persistent volumes:', err);
      setError(err.toString());
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up auto-refresh every 5 seconds
    intervalRef.current = setInterval(fetchData, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatRowData = (pv) => ({
    ...pv,
    status: pv.status,
    claim: pv.claim === '-' ? 'Unbound' : pv.claim
  });

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Error loading persistent volumes: {error}
      </div>
    );
  }

  return (
    <OverviewTableWithPanel
      title="Persistent Volumes"
      columns={columns}
      data={data.map(formatRowData)}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      resourceKind="persistentvolume"
      namespace={namespace}
      onCreateResource={() => showResourceOverlay('persistentvolume', {
        namespace: namespace,
        onSuccess: () => {
          fetchData(); // Refresh the data after successful creation
        }
      })}
    />
  );
}

export default PersistentVolumesOverviewTable;
