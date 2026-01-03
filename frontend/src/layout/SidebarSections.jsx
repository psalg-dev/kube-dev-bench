import React, { useMemo } from 'react';
import { useResourceCounts } from '../state/ResourceCountsContext.jsx';

// Resource sections list with id suffix & label
const resourceSections = [
  { key: 'pods', label: 'Pods', podCounts: true },
  { key: 'deployments', label: 'Deployments' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'cronjobs', label: 'Cron Jobs' },
  { key: 'daemonsets', label: 'Daemon Sets' },
  { key: 'statefulsets', label: 'Stateful Sets' },
  { key: 'replicasets', label: 'Replica Sets' },
  { key: 'configmaps', label: 'Config Maps' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'ingresses', label: 'Ingresses' },
  { key: 'persistentvolumeclaims', label: 'Persistent Volume Claims' },
  { key: 'persistentvolumes', label: 'Persistent Volumes' },
  { key: 'helmreleases', label: 'Helm Releases' },
];

function PodCountsDisplay({ podStatus }) {
  const parts = useMemo(() => {
    if (!podStatus) return [];
    const { running=0, pending=0, failed=0, succeeded=0, unknown=0, total=0 } = podStatus;
    if (total === 0) return [<span key="zero" style={{color:'#9aa0a6', fontWeight:700}}>0</span>];
    const segs = [];
    const push = (val, color, title, k) => { if (val) segs.push(<span key={k} title={title} style={{color, fontWeight:700}}>{val}</span>); };
    push(running, '#2ea44f', 'Running', 'r');
    push(pending, '#e6b800', 'Pending/Creating', 'p');
    push(failed, '#d73a49', 'Failed', 'f');
    push(succeeded, '#9aa0a6', 'Succeeded', 's');
    push(unknown, '#9aa0a6', 'Unknown', 'u');
    if (segs.length === 0) return [<span key="running" style={{color:'#2ea44f', fontWeight:700}}>{running||0}</span>];
    const withSeps = [];
    segs.forEach((el, i) => { withSeps.push(el); if (i < segs.length-1) withSeps.push(<span key={'sep'+i} style={{color:'#666'}}>/</span>); });
    return withSeps;
  }, [podStatus]);
  return <span className="sidebar-pod-counts" style={{display:'flex', gap:8, alignItems:'center', minWidth:'2em', justifyContent:'flex-end'}}>{parts}</span>;
}

export function SidebarSections({ selected, onSelect }) {
  const { counts } = useResourceCounts();
  return (
    <div>
      {resourceSections.map(sec => {
        const isSel = selected === sec.key;
        const commonStyle = {
          padding: '8px 16px', cursor: 'pointer', color: 'var(--gh-table-header-text, #fff)', fontSize: 15,
          margin: 0, borderRadius: 4, transition: 'background 0.15s', textAlign: 'left', display: 'flex',
          alignItems: 'center', gap: 8, justifyContent: 'space-between'
        };
        const value = counts?.[sec.key];
        const isNumber = typeof value === 'number';
        return (
          <div
            key={sec.key}
            id={`section-${sec.key}`}
            className={`sidebar-section${isSel ? ' selected' : ''}`}
            style={commonStyle}
            onClick={(e) => { e.stopPropagation(); onSelect(sec.key); }}
          >
            <span style={{ display:'flex', alignItems:'center', gap:8 }}><span>{sec.label}</span></span>
            {sec.podCounts ? (
              <PodCountsDisplay podStatus={counts?.podStatus || counts?.PodStatus} />
            ) : (
              <span style={{minWidth:'2em', textAlign:'right', color:(isNumber && value>0)?'#8ecfff':'#9aa0a6', fontWeight:700}}>
                {isNumber ? value : '-'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SidebarSections;
