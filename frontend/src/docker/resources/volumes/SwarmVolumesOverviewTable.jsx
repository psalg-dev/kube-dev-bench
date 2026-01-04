import React from 'react';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import { RemoveSwarmVolume } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';
import { formatAge } from '../../../utils/timeUtils.js';

const columns = [
  { id: 'name', header: 'Name', accessorKey: 'name', size: 200 },
  { id: 'driver', header: 'Driver', accessorKey: 'driver', size: 120 },
  { id: 'scope', header: 'Scope', accessorKey: 'scope', size: 100 },
  { id: 'created', header: 'Created', accessorFn: row => formatAge(row.createdAt), size: 120 },
  { id: 'labels', header: 'Labels', accessorFn: row => {
    if (!row.labels) return '-';
    const count = Object.keys(row.labels).length;
    return count > 0 ? `${count} label${count > 1 ? 's' : ''}` : '-';
  }, size: 100 },
];

function VolumeBottomPanel({ item, closePanel, refreshList }) {
  const handleDelete = async () => {
    if (window.confirm(`Delete volume "${item.name}"?`)) {
      try {
        await RemoveSwarmVolume(item.name, false);
        showSuccess(`Volume "${item.name}" deleted`);
        closePanel();
        refreshList();
      } catch (err) {
        showError(`Failed to delete volume: ${err}`);
      }
    }
  };

  const tabs = [
    {
      key: 'summary',
      label: 'Summary',
      render: () => (
        <div style={{ padding: 24 }}>
          <SummaryTabHeader
            title={item.name}
            labels={item.labels}
          />
          <QuickInfoSection>
            <QuickInfoSection.Row label="Name" value={item.name} copyable mono />
            <QuickInfoSection.Row label="Driver" value={item.driver || '-'} />
            <QuickInfoSection.Row label="Scope" value={item.scope || '-'} />
            <QuickInfoSection.Row label="Mountpoint" value={item.mountpoint || '-'} mono />
            <QuickInfoSection.Row label="Created" value={item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'} />
          </QuickInfoSection>
          {item.options && Object.keys(item.options).length > 0 && (
            <>
              <h4 style={{ margin: '24px 0 12px', color: 'var(--gh-text)', fontSize: 14, fontWeight: 600 }}>
                Options
              </h4>
              <QuickInfoSection>
                {Object.entries(item.options).map(([key, val]) => (
                  <QuickInfoSection.Row key={key} label={key} value={val} mono />
                ))}
              </QuickInfoSection>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--gh-text)' }}>{item.name}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <SwarmResourceActions
            onDelete={handleDelete}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: 8, borderBottom: '1px solid var(--gh-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              style={{
                background: 'var(--gh-btn-primary-bg)',
                border: '1px solid var(--gh-border)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 6,
                marginRight: 8,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {tabs[0].render()}
      </div>
    </div>
  );
}

export default function SwarmVolumesOverviewTable() {
  const { volumes, refreshVolumes, loading, connected } = useSwarmState();

  const renderBottomPanel = (item, closePanel, refreshList) => (
    <VolumeBottomPanel item={item} closePanel={closePanel} refreshList={refreshList} />
  );

  if (!connected) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Not connected to Docker Swarm
      </div>
    );
  }

  return (
    <OverviewTableWithPanel
      data={volumes}
      columns={columns}
      renderBottomPanel={renderBottomPanel}
      refreshData={refreshVolumes}
      loading={loading}
      emptyMessage="No volumes found"
      rowKeyAccessor={row => row.name}
    />
  );
}
