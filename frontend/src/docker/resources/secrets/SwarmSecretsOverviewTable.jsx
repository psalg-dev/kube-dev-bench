import React from 'react';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import { RemoveSwarmSecret } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';
import { formatAge } from '../../../utils/timeUtils.js';

const columns = [
  { id: 'name', header: 'Name', accessorKey: 'name', size: 200 },
  { id: 'created', header: 'Created', accessorFn: row => formatAge(row.createdAt), size: 120 },
  { id: 'updated', header: 'Updated', accessorFn: row => formatAge(row.updatedAt), size: 120 },
  { id: 'labels', header: 'Labels', accessorFn: row => {
    if (!row.labels) return '-';
    const count = Object.keys(row.labels).length;
    return count > 0 ? `${count} label${count > 1 ? 's' : ''}` : '-';
  }, size: 100 },
];

function SecretBottomPanel({ item, closePanel, refreshList }) {
  const handleDelete = async () => {
    if (window.confirm(`Delete secret "${item.name}"?`)) {
      try {
        await RemoveSwarmSecret(item.id);
        showSuccess(`Secret "${item.name}" deleted`);
        closePanel();
        refreshList();
      } catch (err) {
        showError(`Failed to delete secret: ${err}`);
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
            <QuickInfoSection.Row label="ID" value={item.id} copyable mono />
            <QuickInfoSection.Row label="Name" value={item.name} />
            <QuickInfoSection.Row label="Created" value={item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'} />
            <QuickInfoSection.Row label="Updated" value={item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'} />
          </QuickInfoSection>
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
                background: 'var(--gh-bg-secondary)',
                border: '1px solid var(--gh-border)',
                color: 'var(--gh-text)',
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

export default function SwarmSecretsOverviewTable() {
  const { secrets, refreshSecrets, loading, connected } = useSwarmState();

  const renderBottomPanel = (item, closePanel, refreshList) => (
    <SecretBottomPanel item={item} closePanel={closePanel} refreshList={refreshList} />
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
      data={secrets}
      columns={columns}
      renderBottomPanel={renderBottomPanel}
      refreshData={refreshSecrets}
      loading={loading}
      emptyMessage="No secrets found"
      rowKeyAccessor={row => row.id}
      createPlatform="swarm"
      createKind="secret"
    />
  );
}
