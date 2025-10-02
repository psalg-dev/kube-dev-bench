import React, { useState, useEffect, useRef } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import { GetPersistentVolumeClaims } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

export default function PersistentVolumeClaimsOverviewTable({ namespace, onPVCCreate }) {
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

  const periodicFetch = async (ns) => {
    if (inFlightRef.current || !ns) return;
    inFlightRef.current = true;
    try {
      const data = await GetPersistentVolumeClaims(ns);
      setPVCs(Array.isArray(data) ? data : []);
    } catch (_) {
      // ignore periodic errors
    } finally {
      inFlightRef.current = false;
    }
  };

  const startFastPollingWindow = (ns) => {
    if (!ns) return;
    clearTimers();
    let elapsed = 0;
    fastTimerRef.current = setInterval(async () => {
      await periodicFetch(ns);
      elapsed += 1;
      if (elapsed >= 60) {
        if (fastTimerRef.current) {
          clearInterval(fastTimerRef.current);
          fastTimerRef.current = null;
        }
        slowTimerRef.current = setInterval(() => periodicFetch(ns), 60000);
      }
    }, 1000);
  };

  const fetchPVCs = async () => {
    if (!namespace) return;

    setLoading(true);
    setError(null);
    try {
      const data = await GetPersistentVolumeClaims(namespace);
      setPVCs(data || []);
    } catch (err) {
      console.error('Error fetching PVCs:', err);
      setError(err.message || 'Failed to fetch persistent volume claims');
      setPVCs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPVCs();
    // Start a fast window when view opens
    startFastPollingWindow(namespace);
    return () => clearTimers();
  }, [namespace]);

  // Generic resource-updated fallback
  useEffect(() => {
    const unsubscribe = EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'persistentvolumeclaim' && eventData?.namespace === namespace) {
        fetchPVCs();
        // Restart fast polling window upon new resource creation
        startFastPollingWindow(namespace);
      }
    });

    return () => {
      EventsOff('resource-updated', unsubscribe);
    };
  }, [namespace]);

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue();
        let color = 'var(--gh-text)';
        if (status === 'Bound') color = '#28a745';
        else if (status === 'Pending') color = '#ffc107';
        else if (status === 'Lost') color = '#dc3545';

        return (
          <span style={{ color, fontWeight: '500' }}>
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'volume',
      header: 'Volume',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'capacity',
      header: 'Capacity',
    },
    {
      accessorKey: 'accessModes',
      header: 'Access Modes',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'storageClass',
      header: 'Storage Class',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'age',
      header: 'Age',
      cell: ({ getValue }) => (
        <span style={{ color: 'var(--gh-text-muted)' }}>
          {getValue()}
        </span>
      ),
    },
  ];

  const handleRowClick = (pvc) => {
    setSelectedPVC(pvc);
  };

  const tabs = [
    { key: 'summary', label: 'Summary' }
  ];

  const renderPanelContent = (row, activeTab) => {
    if (!row) return null;

    // For PVCs, we only have one tab (summary), so we can ignore activeTab
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--gh-text)' }}>Basic Information</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <div><strong>Name:</strong> {row.name}</div>
              <div><strong>Namespace:</strong> {row.namespace}</div>
              <div><strong>Status:</strong> {row.status}</div>
              <div><strong>Age:</strong> {row.age}</div>
            </div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--gh-text)' }}>Storage Information</h4>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <div><strong>Volume:</strong> {row.volume}</div>
              <div><strong>Capacity:</strong> {row.capacity}</div>
              <div><strong>Access Modes:</strong> {row.accessModes}</div>
              <div><strong>Storage Class:</strong> {row.storageClass}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
      columns={columns}
      data={pvcs}
      onRowClick={handleRowClick}
      renderPanelContent={renderPanelContent}
      panelHeader={selectedPVC ? `Persistent Volume Claim: ${selectedPVC.name}` : ''}
      title="Persistent Volume Claims"
      resourceKind="persistentvolumeclaim"
      namespace={namespace}
      onCreateResource={onPVCCreate}
      tabs={tabs}
    />
  );
}
