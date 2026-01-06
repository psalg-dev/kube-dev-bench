import React, { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import ServiceTasksTab from './ServiceTasksTab.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import UpdateServiceImageModal from './UpdateServiceImageModal.jsx';
import {
  GetSwarmServices,
  ScaleSwarmService,
  RemoveSwarmService,
  RestartSwarmService,
  GetSwarmServiceLogs,
  UpdateSwarmServiceImage,
} from '../../swarmApi.js';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { showSuccess, showError } from '../../../notification.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils.js';

const columns = [
  { key: 'name', label: 'Name' },
  {
    key: 'image',
    label: 'Image',
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return '-';
      return (
        <span
          title={val}
          style={{
            display: 'inline-block',
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            verticalAlign: 'bottom',
          }}
        >
          {val}
        </span>
      );
    },
  },
  { key: 'mode', label: 'Mode' },
  { key: 'replicas', label: 'Replicas', cell: ({ getValue }) => {
    const val = getValue();
    return val !== undefined ? val : '-';
  }},
  { key: 'runningTasks', label: 'Running' },
  { key: 'ports', label: 'Ports', cell: ({ getValue }) => {
    const ports = getValue();
    if (!ports || ports.length === 0) return '-';
    return ports.map(p => `${p.publishedPort}:${p.targetPort}/${p.protocol}`).join(', ');
  }},
  { key: 'createdAt', label: 'Created', cell: ({ getValue }) => {
    const val = getValue();
    if (!val) return '-';
    return formatTimestampDMYHMS(val);
  }},
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'placement', label: 'Placement' },
  { key: 'logs', label: 'Logs' },
];

function formatBytes(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return '-';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const fixed = i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(fixed)} ${units[i]}`;
}

function formatNanoCPUs(nanoCpus) {
  const n = Number(nanoCpus);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const cores = n / 1e9;
  const fixed = cores >= 10 ? 1 : 2;
  return `${cores.toFixed(fixed)} cores`;
}

function splitEnvKey(env) {
  const s = String(env || '');
  const idx = s.indexOf('=');
  if (idx === -1) return s;
  return s.slice(0, idx);
}

function maskEnv(env) {
  const s = String(env || '');
  const idx = s.indexOf('=');
  if (idx === -1) return s;
  const key = s.slice(0, idx);
  const val = s.slice(idx + 1);
  if (!val) return `${key}=`;
  return `${key}=<hidden>`;
}

function formatMount(m) {
  if (!m) return '-';
  const type = m.type || 'mount';
  const src = m.source || '-';
  const tgt = m.target || '-';
  const ro = m.readOnly ? ' (ro)' : '';
  return `${type}:${src} -> ${tgt}${ro}`;
}

function ServicePlacementTab({ row }) {
  const placement = row?.placement;
  const constraints = Array.isArray(placement?.constraints) ? placement.constraints : [];
  const preferences = Array.isArray(placement?.preferences) ? placement.preferences : [];
  const maxReplicas = placement?.maxReplicas;

  return (
    <div style={{ padding: 16, color: 'var(--gh-text, #c9d1d9)' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Placement</div>
      <div style={{ marginBottom: 12, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
        Placement constraints and preferences from the service spec.
      </div>

      <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 4 }}>Constraints</div>
          {constraints.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {constraints.map((c) => <li key={c} style={{ marginBottom: 4 }}>{c}</li>)}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>-</div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 4 }}>Preferences</div>
          {preferences.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {preferences.map((p) => <li key={p} style={{ marginBottom: 4 }}>{p}</li>)}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>-</div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', marginBottom: 4 }}>Max Replicas</div>
          <div style={{ fontSize: 12 }}>{maxReplicas ? String(maxReplicas) : '-'}</div>
        </div>
      </div>
    </div>
  );
}

function ServiceSummaryPanel({ row, onRefresh }) {
  const [showUpdateImage, setShowUpdateImage] = useState(false);

    const quickInfoFields = [
      {
        key: 'mode',
        label: 'Mode',
        layout: 'flex',
        rightField: {
          key: 'replicas',
          label: 'Replicas',
        }
      },
      {
        key: 'runningTasks',
        label: 'Running Tasks',
        layout: 'flex',
        rightField: {
          key: 'createdAt',
          label: 'Created',
          type: 'date',
        }
      },
      { key: 'image', label: 'Image', type: 'break-word' },
      {
        key: 'ports',
        label: 'Ports',
        type: 'list',
        getValue: (d) => (Array.isArray(d.ports) ? d.ports : []).map(p => `${p.publishedPort}:${p.targetPort}/${p.protocol}${p.publishMode ? ` (${p.publishMode})` : ''}`),
      },
      {
        key: 'env',
        label: 'Environment Variables',
        type: 'list',
        getValue: (d) => {
          const env = Array.isArray(d.env) ? d.env : [];
          if (!env.length) return [];
          // Avoid leaking env values in the summary; show keys only.
          return env.map(maskEnv);
        },
      },
      {
        key: 'mounts',
        label: 'Mounts',
        type: 'list',
        getValue: (d) => (Array.isArray(d.mounts) ? d.mounts : []).map(formatMount),
      },
      {
        key: 'updateConfig',
        label: 'Update Config',
        type: 'list',
        getValue: (d) => {
          const uc = d.updateConfig;
          if (!uc) return [];
          return [
            `parallelism: ${uc.parallelism ?? '-'}`,
            `delay: ${uc.delay || '-'}`,
            `failureAction: ${uc.failureAction || '-'}`,
            `monitor: ${uc.monitor || '-'}`,
            `maxFailureRatio: ${uc.maxFailureRatio ?? '-'}`,
            `order: ${uc.order || '-'}`,
          ];
        },
      },
      {
        key: 'resources',
        label: 'Resources',
        type: 'list',
        getValue: (d) => {
          const r = d.resources;
          if (!r) return [];
          const out = [];
          if (r.limits) {
            out.push(`limits.cpu: ${formatNanoCPUs(r.limits.nanoCpus)}`);
            out.push(`limits.mem: ${formatBytes(r.limits.memoryBytes)}`);
          }
          if (r.reservations) {
            out.push(`reservations.cpu: ${formatNanoCPUs(r.reservations.nanoCpus)}`);
            out.push(`reservations.mem: ${formatBytes(r.reservations.memoryBytes)}`);
          }
          return out;
        },
      },
      {
        key: 'placementConstraints',
        label: 'Placement Constraints',
        type: 'list',
        getValue: (d) => {
          const p = d.placement;
          return Array.isArray(p?.constraints) ? p.constraints : [];
        },
      },
      {
        key: 'placementPreferences',
        label: 'Placement Preferences',
        type: 'list',
        getValue: (d) => {
          const p = d.placement;
          return Array.isArray(p?.preferences) ? p.preferences : [];
        },
      },
      { key: 'id', label: 'Service ID', type: 'break-word' },
    ];

    const handleScale = async (newReplicas) => {
      try {
        await ScaleSwarmService(row.id, newReplicas);
        showSuccess(`Scaled service ${row.name} to ${newReplicas} replicas`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to scale service: ${err}`);
      }
    };

    const handleRestart = async () => {
      try {
        await RestartSwarmService(row.id);
        showSuccess(`Restarted service ${row.name}`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to restart service: ${err}`);
      }
    };

    const handleDelete = async () => {
      try {
        await RemoveSwarmService(row.id);
        showSuccess(`Removed service ${row.name}`);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to remove service: ${err}`);
      }
    };

    const handleUpdateImage = async (newImage) => {
      try {
        await UpdateSwarmServiceImage(row.id, newImage);
        showSuccess(`Updated service ${row.name} image`);
        setShowUpdateImage(false);
        onRefresh?.();
      } catch (err) {
        showError(`Failed to update service image: ${err}`);
      }
    };

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

    return (
      <>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SummaryTabHeader
            name={row.name}
            labels={row.labels}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  id="swarm-service-update-image-btn"
                  style={buttonStyle}
                  onClick={() => setShowUpdateImage(true)}
                >
                  Update Image
                </button>
                <SwarmResourceActions
                  resourceType="service"
                  name={row.name}
                  canScale={row.mode === 'replicated'}
                  currentReplicas={row.replicas}
                  onScale={handleScale}
                  onRestart={handleRestart}
                  onDelete={handleDelete}
                />
              </div>
            }
          />
          <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
            <QuickInfoSection
              resourceName={row.name}
              data={row}
              loading={false}
              error={null}
              fields={quickInfoFields}
            />
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
              <AggregateLogsTab
                title="Service Logs"
                reloadKey={row.id}
                loadLogs={() => GetSwarmServiceLogs(row.id, '100')}
              />
            </div>
          </div>
        </div>

        <UpdateServiceImageModal
          open={showUpdateImage}
          currentImage={row.image}
          serviceName={row.name}
          onClose={() => setShowUpdateImage(false)}
          onConfirm={handleUpdateImage}
        />
      </>
    );
}

function renderPanelContent(row, tab, onRefresh) {
  if (tab === 'summary') {
    return <ServiceSummaryPanel row={row} onRefresh={onRefresh} />;
  }

  if (tab === 'tasks') {
    return <ServiceTasksTab serviceId={row.id} serviceName={row.name} />;
  }

  if (tab === 'placement') {
    return <ServicePlacementTab row={row} />;
  }

  if (tab === 'logs') {
    return (
      <AggregateLogsTab
        title="Service Logs"
        reloadKey={row.id}
        loadLogs={() => GetSwarmServiceLogs(row.id, '500')}
      />
    );
  }

  return null;
}

export default function SwarmServicesOverviewTable() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const data = await GetSwarmServices();
        if (active) {
          setServices(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Swarm services:', err);
        if (active) {
          setServices([]);
          setLoading(false);
        }
      }
    };

    loadServices();

    // Subscribe to real-time updates
    const off = EventsOn('swarm:services:update', (data) => {
      if (active && Array.isArray(data)) {
        setServices(data);
      } else if (active) {
        refresh();
      }
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, [refreshKey]);

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm services...</div>;
  }

  return (
    <OverviewTableWithPanel
      title="Swarm Services"
      columns={columns}
      data={services}
      tabs={bottomTabs}
      renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
      tableTestId="swarm-services-table"
      createPlatform="swarm"
      createKind="service"
    />
  );
}
