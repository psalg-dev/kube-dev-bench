import React from 'react';

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
];

export function SidebarSections({ selected, onSelect }) {
  return (
    <div>
      {resourceSections.map(sec => {
        const isSel = selected === sec.key;
        const commonStyle = {
          padding: '8px 16px', cursor: 'pointer', color: 'var(--gh-table-header-text, #fff)', fontSize: 15,
          margin: 0, borderRadius: 4, transition: 'background 0.15s', textAlign: 'left', display: 'flex',
          alignItems: 'center', gap: 8, justifyContent: 'space-between'
        };
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
              <span className="sidebar-pod-counts" id="sidebar-pod-counts" style={{display:'flex', gap:8, alignItems:'center', minWidth:'2em', justifyContent:'flex-end'}}>
                <span style={{color:'#8ecfff', fontWeight:'bold'}}>-</span>
              </span>
            ) : (
              <span id={`sidebar-${sec.key}-count`} style={{minWidth:'2em', textAlign:'right', color:'#9aa0a6', fontWeight:700}}>-</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SidebarSections;

