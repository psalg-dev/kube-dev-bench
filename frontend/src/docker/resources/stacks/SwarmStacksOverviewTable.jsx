import React, { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import StackServicesTab from './StackServicesTab.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import { GetSwarmStacks, RemoveSwarmStack } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'services', label: 'Services' },
  { key: 'orchestrator', label: 'Orchestrator' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'services', label: 'Services' },
];

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    const handleDelete = async () => {
      try {
        await RemoveSwarmStack(row.name);
        showSuccess(`Removed stack "${row.name}"`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove stack: ${err}`);
      }
    };

    const quickInfoFields = [
      { key: 'name', label: 'Stack Name' },
      { key: 'services', label: 'Services' },
      { key: 'orchestrator', label: 'Orchestrator' },
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader
          name={row.name}
          actions={(
            <SwarmResourceActions
              resourceType="stack"
              name={row.name}
              onDelete={handleDelete}
            />
          )}
        />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
        </div>
      </div>
    );
  }

  if (tab === 'services') {
    return <StackServicesTab stackName={row.name} />;
  }

  return null;
}

export default function SwarmStacksOverviewTable() {
  const swarm = useSwarmState();
  const connected = swarm?.connected;
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!connected) {
      setStacks([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadStacks = async () => {
      try {
        const data = await GetSwarmStacks();
        if (active) {
          setStacks(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load stacks:', err);
        if (active) {
          setStacks([]);
          setLoading(false);
        }
      }
    };

    loadStacks();

    const off = EventsOn('swarm:stacks:update', (data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setStacks(data);
      } else {
        refresh();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [connected, refreshKey, refresh]);

  if (!connected) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Not connected to Docker Swarm
      </div>
    );
  }

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm stacks...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Stacks"
      columns={columns}
      data={stacks}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
      createPlatform="swarm"
      createKind="stack"
      createButtonTitle="Deploy stack (Compose YAML)"
      tableTestId="swarm-stacks-table"
    />
  );
}
