import React, { useState, useEffect, useRef } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

export default function PersistentVolumeClaimsOverviewTable({ namespaces, onPVCCreate }) {
  const [pvcs, setPVCs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPVC, setSelectedPVC] = useState(null);

  // Timers and guards as refs so we can restart fast polling on new creates
  const inFlightRef = useRef(false);
  const fastTimerRef = useRef(null);
  const slowTimerRef = useRef(null);

  const clearTimers = () => {
    if (fastTimerRef.current) {
      clearInterval(fastTimerRef.current);
      fastTimerRef.current = null;
    }
    if (slowTimerRef.current) {
      clearInterval(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  };

  // Normalize PVC data
  const normalize = (arr) => (arr || []).filter(Boolean).map((i) => ({
    name: i.name ?? i.Name,
    namespace: i.namespace ?? i.Namespace,
    status: i.status ?? i.Status ?? '-',
    storage: i.storage ?? i.Storage ?? '-',
    accessModes: Array.isArray(i.accessModes ?? i.AccessModes) ? (i.accessModes ?? i.AccessModes).join(', ') : '-',
    volumeName: i.volumeName ?? i.VolumeName ?? '-',
    age: i.age ?? i.Age ?? '-',
  }));

  // Fetch PVCs for all selected namespaces
  const fetchAllPVCs = async () => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setPVCs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetPersistentVolumeClaims(ns).catch(() => []))
      );
      setPVCs(normalize([].concat(...results).filter(Boolean)));
    } catch (err) {
      console.error('Error fetching PVCs:', err);
      setError(err.message || 'Failed to fetch persistent volume claims');
      setPVCs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPVCs();
    // Start a fast window when view opens
    clearTimers();
    let elapsed = 0;
    if (Array.isArray(namespaces) && namespaces.length > 0) {
      fastTimerRef.current = setInterval(async () => {
        await fetchAllPVCs();
        elapsed += 1;
        if (elapsed >= 60) {
          if (fastTimerRef.current) {
            clearInterval(fastTimerRef.current);
            fastTimerRef.current = null;
          }
          slowTimerRef.current = setInterval(() => fetchAllPVCs(), 60000);
        }
      }, 1000);
    }
    return () => clearTimers();
  }, [namespaces]);

  // Generic resource-updated fallback
  useEffect(() => {
    const onUpdate = (eventData) => {
      if (eventData?.resource === 'persistentvolumeclaim' && (!namespaces || namespaces.includes(eventData?.namespace))) {
        fetchAllPVCs();
        clearTimers();
        let elapsed = 0;
        if (Array.isArray(namespaces) && namespaces.length > 0) {
          fastTimerRef.current = setInterval(async () => {
            await fetchAllPVCs();
            elapsed += 1;
            if (elapsed >= 60) {
              if (fastTimerRef.current) {
                clearInterval(fastTimerRef.current);
                fastTimerRef.current = null;
              }
              slowTimerRef.current = setInterval(() => fetchAllPVCs(), 60000);
            }
          }, 1000);
        }
      }
    };
    EventsOn('resource-updated', onUpdate);
    return () => {
      EventsOff('resource-updated', onUpdate);
    };
  }, [namespaces]);

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'status', label: 'Status' },
    { key: 'storage', label: 'Storage' },
    { key: 'accessModes', label: 'Access Modes' },
    { key: 'volumeName', label: 'Volume Name' },
    { key: 'age', label: 'Age' },
  ];

  // Panel content and header can be implemented similarly to other resources
  function renderPanelContent(row, tab) {
    if (tab === 'summary') {
      return (
        <div>
          <h3>Summary</h3>
          <p><b>Name:</b> {row.name}</p>
          <p><b>Namespace:</b> {row.namespace}</p>
          <p><b>Status:</b> {row.status}</p>
          <p><b>Storage:</b> {row.storage}</p>
          <p><b>Access Modes:</b> {row.accessModes}</p>
          <p><b>Volume Name:</b> {row.volumeName}</p>
          <p><b>Age:</b> {row.age}</p>
        </div>
      );
    }
    if (tab === 'events') {
      return (
        <div>
          <h3>Events</h3>
          <p>No events (mock data).</p>
        </div>
      );
    }
    if (tab === 'yaml') {
      return (
        <div>
          <h3>YAML</h3>
          <pre style={{ background: '#222', color: '#eee', padding: 12 }}>{`apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${row.name}\n  namespace: ${row.namespace}\nspec:\n  accessModes: [${row.accessModes}]\n  resources:\n    requests:\n      storage: ${row.storage}`}</pre>
        </div>
      );
    }
    return null;
  }

  function panelHeader(row) {
    return <span style={{ fontWeight: 600 }}>{row.name}</span>;
  }

  const bottomTabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'events', label: 'Events' },
    { key: 'yaml', label: 'YAML' },
  ];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: 'var(--gh-text-muted)'
      }}>
        Loading Persistent Volume Claims...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        color: '#dc3545',
        backgroundColor: 'var(--gh-danger-bg)',
        border: '1px solid var(--gh-danger-border)',
        borderRadius: '6px',
        margin: '20px'
      }}>
        Error loading Persistent Volume Claims: {error}
      </div>
    );
  }

  return (
    <OverviewTableWithPanel
      title="Persistent Volume Claims"
      columns={columns}
      data={pvcs}
      loading={loading}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      panelHeader={panelHeader}
      resourceKind="persistentvolumeclaim"
      namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
      onCreateResource={onPVCCreate}
    />
  );
}
