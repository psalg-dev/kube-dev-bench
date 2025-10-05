import React, { useState, useEffect, useRef } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import FilesTab from '../../../layout/bottompanel/FilesTab.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';

export default function PersistentVolumeClaimsOverviewTable({ namespaces, onPVCCreate }) {
  const [pvcs, setPVCs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    labels: i.labels ?? i.Labels ?? i.metadata?.labels ?? {}
  }));

  // Fetch PVCs for all selected namespaces
  const fetchAllPVCs = async (isInitialLoad = false) => {
    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      setPVCs([]);
      return;
    }
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const results = await Promise.all(
        namespaces.map(ns => AppAPI.GetPersistentVolumeClaims(ns).catch(() => []))
      );
      setPVCs(normalize([].concat(...results).filter(Boolean)));
    } catch (err) {
      console.error('Error fetching PVCs:', err);
      setError(err.message || 'Failed to fetch persistent volume claims');
      if (isInitialLoad) {
        setPVCs([]);
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAllPVCs(true); // Initial load
    // Start a fast window when view opens
    clearTimers();
    let elapsed = 0;
    if (Array.isArray(namespaces) && namespaces.length > 0) {
      fastTimerRef.current = setInterval(async () => {
        await fetchAllPVCs(false); // Subsequent refreshes without loading state
        elapsed += 1;
        if (elapsed >= 60) {
          if (fastTimerRef.current) {
            clearInterval(fastTimerRef.current);
            fastTimerRef.current = null;
          }
          slowTimerRef.current = setInterval(() => fetchAllPVCs(false), 60000);
        }
      }, 1000);
    }
    return () => clearTimers();
  }, [namespaces]);

  // Generic resource-updated fallback
  useEffect(() => {
    const onUpdate = (eventData) => {
      if (eventData?.resource === 'persistentvolumeclaim' && (!namespaces || namespaces.includes(eventData?.namespace))) {
        fetchAllPVCs(false); // Refresh without loading state
        clearTimers();
        let elapsed = 0;
        if (Array.isArray(namespaces) && namespaces.length > 0) {
          fastTimerRef.current = setInterval(async () => {
            await fetchAllPVCs(false); // Subsequent refreshes without loading state
            elapsed += 1;
            if (elapsed >= 60) {
              if (fastTimerRef.current) {
                clearInterval(fastTimerRef.current);
                fastTimerRef.current = null;
              }
              slowTimerRef.current = setInterval(() => fetchAllPVCs(false), 60000);
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
    { key: 'volumeName', label: 'Volume' },
    { key: 'age', label: 'Age' }
  ];

  const bottomTabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'yaml', label: 'YAML' },
    { key: 'files', label: 'Files' },
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
        { key: 'storage', label: 'Storage' },
        { key: 'accessModes', label: 'Access Modes' },
        { key: 'volumeName', label: 'Volume Name' },
        { key: 'name', label: 'PVC name', type: 'break-word' }
      ];

      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="pvc" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource("pvc", ns, n);}} />} />
          {/* Main content */}
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
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Persistent Volume Claim Details</div>
              <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
                <strong>Status:</strong> {row.status || '-'}<br />
                <strong>Storage:</strong> {row.storage || '-'}<br />
                <strong>Access Modes:</strong> {row.accessModes || '-'}<br />
                <strong>Volume Name:</strong> {row.volumeName || '-'}<br />
                <strong>Namespace:</strong> {row.namespace || '-'}
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (tab === 'yaml') {
      const yamlContent = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  accessModes:
  ${row.accessModes ? `- ${row.accessModes}` : '- ReadWriteOnce'}
  resources:
    requests:
      storage: ${row.storage}
status:
  phase: ${row.status}`;

      return <YamlTab content={yamlContent} />;
    }
    if (tab === 'files') {
      return <FilesTab namespace={row.namespace} pvcName={row.name} />;
    }
    return null;
  }

  function panelHeader(row) {
    return <span style={{ fontWeight: 600 }}>{row.name}</span>;
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
