import React, { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext.jsx';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import StackServicesTab from './StackServicesTab.jsx';
import StackResourcesTab from './StackResourcesTab.jsx';
import StackComposeTab from './StackComposeTab.jsx';
import UpdateStackModal from './UpdateStackModal.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import { CreateSwarmStack, GetSwarmStackComposeYAML, GetSwarmStackServices, GetSwarmStacks, RemoveSwarmStack, RollbackSwarmStack } from '../../swarmApi.js';
import { showSuccess, showError } from '../../../notification.js';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'services', label: 'Services' },
  { key: 'orchestrator', label: 'Orchestrator' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'services', label: 'Services' },
  { key: 'networks', label: 'Networks' },
  { key: 'volumes', label: 'Volumes' },
  { key: 'configs', label: 'Configs' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'compose', label: 'Compose File' },
];

function StackSummaryPanel({ row, onRefresh }) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [compose, setCompose] = useState('');
  const [loadingCompose, setLoadingCompose] = useState(false);
  const [health, setHealth] = useState({ healthy: 0, unhealthy: 0, total: 0 });

  const buttonStyle = {
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid var(--gh-border, #30363d)',
    backgroundColor: 'var(--gh-button-bg, #21262d)',
    color: 'var(--gh-text, #c9d1d9)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };

  const downloadTextFile = (filename, content) => {
    const blob = new Blob([content ?? ''], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const loadCompose = async () => {
    setLoadingCompose(true);
    try {
      const y = await GetSwarmStackComposeYAML(row.name);
      setCompose(y || '');
      return y || '';
    } finally {
      setLoadingCompose(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadHealth = async () => {
      try {
        const svcs = await GetSwarmStackServices(row.name);
        if (!active) return;
        const list = Array.isArray(svcs) ? svcs : [];
        let healthy = 0;
        let unhealthy = 0;
        for (const s of list) {
          if (s.mode === 'replicated') {
            if (Number(s.runningTasks) === Number(s.replicas)) healthy++; else unhealthy++;
          } else {
            if (Number(s.runningTasks) > 0) healthy++; else unhealthy++;
          }
        }
        setHealth({ healthy, unhealthy, total: list.length });
      } catch {
        if (active) setHealth({ healthy: 0, unhealthy: 0, total: 0 });
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [row.name]);

  const handleDelete = async () => {
      try {
        await RemoveSwarmStack(row.name);
        showSuccess(`Removed stack "${row.name}"`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove stack: ${err}`);
      }
  };

  const handleExport = async () => {
    try {
      const y = compose || (await loadCompose());
      downloadTextFile(`${row.name}.docker-compose.yml`, y || '');
      showSuccess(`Exported stack "${row.name}" compose`);
    } catch (err) {
      showError(`Failed to export compose: ${err}`);
    }
  };

  const handleOpenUpdate = async () => {
    try {
      const y = compose || (await loadCompose());
      setCompose(y || '');
      setShowUpdate(true);
    } catch (err) {
      showError(`Failed to load compose: ${err}`);
    }
  };

  const handleRedeploy = async (yaml) => {
    try {
      await CreateSwarmStack(row.name, yaml);
      showSuccess(`Updated stack "${row.name}"`);
      setShowUpdate(false);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to update stack: ${err}`);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm(`Rollback stack "${row.name}"? This will attempt to rollback each service in the stack.`)) return;
    try {
      await RollbackSwarmStack(row.name);
      showSuccess(`Rollback triggered for stack "${row.name}"`);
      onRefresh?.();
    } catch (err) {
      showError(`Failed to rollback stack: ${err}`);
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                id="swarm-stack-update-btn"
                style={buttonStyle}
                onClick={handleOpenUpdate}
                disabled={loadingCompose}
              >
                {loadingCompose ? 'Loading...' : 'Update'}
              </button>
              <button
                id="swarm-stack-export-btn"
                style={buttonStyle}
                onClick={handleExport}
                disabled={loadingCompose}
              >
                Export
              </button>
              <button
                id="swarm-stack-rollback-btn"
                style={buttonStyle}
                onClick={handleRollback}
              >
                Rollback
              </button>
              <SwarmResourceActions
                resourceType="stack"
                name={row.name}
                onDelete={handleDelete}
              />
            </div>
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
          <div style={{ width: 340, padding: 16, borderLeft: '1px solid var(--gh-border, #30363d)' }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>
              Health Summary
            </div>
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
              Services healthy: <span style={{ color: '#3fb950' }}>{health.healthy}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
              Services unhealthy: <span style={{ color: '#f85149' }}>{health.unhealthy}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
              Total services: {health.total}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gh-text-secondary, #8b949e)' }}>
              Derived from service running/desired counts.
            </div>
          </div>
        </div>

        <UpdateStackModal
          open={showUpdate}
          stackName={row.name}
          initialComposeYAML={compose}
          onClose={() => setShowUpdate(false)}
          onConfirm={handleRedeploy}
        />
      </div>
    );
}

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    return <StackSummaryPanel row={row} onRefresh={onRefresh} />;
  }

  if (tab === 'services') {
    return <StackServicesTab stackName={row.name} />;
  }

  if (tab === 'networks') {
    return <StackResourcesTab stackName={row.name} resource="networks" />;
  }
  if (tab === 'volumes') {
    return <StackResourcesTab stackName={row.name} resource="volumes" />;
  }
  if (tab === 'configs') {
    return <StackResourcesTab stackName={row.name} resource="configs" />;
  }
  if (tab === 'secrets') {
    return <StackResourcesTab stackName={row.name} resource="secrets" />;
  }
  if (tab === 'compose') {
    return <StackComposeTab stackName={row.name} />;
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
      getRowActions={(row) => ([
        {
          label: 'Delete',
          icon: '🗑️',
          danger: true,
          onClick: async () => {
            if (!window.confirm(`Delete stack "${row.name}"?`)) return;
            try {
              await RemoveSwarmStack(row.name);
              showSuccess(`Removed stack "${row.name}"`);
              refresh();
            } catch (err) {
              showError(`Failed to remove stack: ${err}`);
            }
          },
        },
      ])}
    />
  );
}
