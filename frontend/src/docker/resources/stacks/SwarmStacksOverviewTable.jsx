import React, { useState, useMemo } from 'react';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import StackServicesTab from './StackServicesTab.jsx';
import { RemoveSwarmStack } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { id: 'name', header: 'Name', accessorKey: 'name', size: 200 },
  { id: 'services', header: 'Services', accessorFn: row => row.serviceCount || 0, size: 100 },
  { id: 'networks', header: 'Networks', accessorFn: row => row.networkCount || 0, size: 100 },
  { id: 'configs', header: 'Configs', accessorFn: row => row.configCount || 0, size: 100 },
  { id: 'secrets', header: 'Secrets', accessorFn: row => row.secretCount || 0, size: 100 },
];

function StackBottomPanel({ item, closePanel, refreshList }) {
  const [activeTab, setActiveTab] = useState('summary');

  const handleDelete = async () => {
    if (window.confirm(`Remove stack "${item.name}"? This will remove all services, networks, and other resources in this stack.`)) {
      try {
        await RemoveSwarmStack(item.name);
        showSuccess(`Stack "${item.name}" removed`);
        closePanel();
        refreshList();
      } catch (err) {
        showError(`Failed to remove stack: ${err}`);
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
          />
          <QuickInfoSection>
            <QuickInfoSection.Row label="Name" value={item.name} />
            <QuickInfoSection.Row label="Services" value={String(item.serviceCount || 0)} />
            <QuickInfoSection.Row label="Networks" value={String(item.networkCount || 0)} />
            <QuickInfoSection.Row label="Configs" value={String(item.configCount || 0)} />
            <QuickInfoSection.Row label="Secrets" value={String(item.secretCount || 0)} />
          </QuickInfoSection>
        </div>
      ),
    },
    {
      key: 'services',
      label: 'Services',
      render: () => <StackServicesTab stackName={item.name} />,
    },
  ];

  const activeTabObj = tabs.find(t => t.key === activeTab) || tabs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--gh-text)' }}>{item.name}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <SwarmResourceActions
            onDelete={handleDelete}
            deleteLabel="Remove Stack"
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, borderBottom: '1px solid var(--gh-border)', display: 'flex', gap: 8 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: tab.key === activeTab ? 'var(--gh-btn-primary-bg)' : 'var(--gh-bg-secondary)',
                border: '1px solid var(--gh-border)',
                color: tab.key === activeTab ? '#fff' : 'var(--gh-text)',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {activeTabObj.render()}
        </div>
      </div>
    </div>
  );
}

export default function SwarmStacksOverviewTable() {
  const { stacks, refreshStacks, loading, connected } = useSwarmState();

  const renderBottomPanel = (item, closePanel, refreshList) => (
    <StackBottomPanel item={item} closePanel={closePanel} refreshList={refreshList} />
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
      data={stacks}
      columns={columns}
      renderBottomPanel={renderBottomPanel}
      refreshData={refreshStacks}
      loading={loading}
      emptyMessage="No stacks found"
      rowKeyAccessor={row => row.name}
    />
  );
}
