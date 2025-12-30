import React, { useEffect, useState, useRef } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import './StatefulSetPVCsTab.css';

/**
 * Shows PVCs associated with a StatefulSet.
 * 
 * @param {string} namespace - The namespace of the StatefulSet
 * @param {string} statefulSetName - The name of the StatefulSet
 */
export default function StatefulSetPVCsTab({ namespace, statefulSetName }) {
  const [pvcs, setPvcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchPVCs = async (isInitial = false) => {
    if (!statefulSetName || !namespace) return;
    
    if (isInitial) setLoading(true);
    setError(null);
    
    try {
      const result = await AppAPI.GetStatefulSetDetail(namespace, statefulSetName);
      setPvcs(result?.pvcs || []);
    } catch (err) {
      setError(err?.message || String(err));
      if (isInitial) setPvcs([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPVCs(true);
    intervalRef.current = setInterval(() => fetchPVCs(false), 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [namespace, statefulSetName]);

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'bound') return { bg: 'rgba(46,160,67,0.15)', fg: '#3fb950' };
    if (s === 'pending') return { bg: 'rgba(187,128,9,0.15)', fg: '#d29922' };
    if (s === 'lost') return { bg: 'rgba(248,81,73,0.15)', fg: '#f85149' };
    return { bg: 'rgba(110,118,129,0.12)', fg: '#8b949e' };
  };

  if (loading) {
    return (
      <div className="statefulset-pvcs-tab">
        <div className="pvcs-loading">Loading PVCs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statefulset-pvcs-tab">
        <div className="pvcs-error">Error: {error}</div>
      </div>
    );
  }

  if (pvcs.length === 0) {
    return (
      <div className="statefulset-pvcs-tab">
        <div className="pvcs-empty">No PVCs found for this StatefulSet.</div>
      </div>
    );
  }

  return (
    <div className="statefulset-pvcs-tab">
      <div className="pvcs-header">
        <span className="pvcs-count">{pvcs.length} PVC{pvcs.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="pvcs-list">
        <table className="pvcs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Capacity</th>
              <th>Access Modes</th>
              <th>Storage Class</th>
              <th>Pod</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {pvcs.map((pvc, idx) => {
              const statusColor = getStatusColor(pvc.status);
              return (
                <tr key={idx} className="pvc-row">
                  <td className="pvc-name">{pvc.name || '-'}</td>
                  <td>
                    <span 
                      className="pvc-status-badge"
                      style={{ background: statusColor.bg, color: statusColor.fg }}
                    >
                      {pvc.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="pvc-capacity">{pvc.capacity || '-'}</td>
                  <td className="pvc-access">{pvc.accessModes || '-'}</td>
                  <td className="pvc-storage-class">{pvc.storageClass || '-'}</td>
                  <td className="pvc-pod">{pvc.podName || '-'}</td>
                  <td className="pvc-age">{pvc.age || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
