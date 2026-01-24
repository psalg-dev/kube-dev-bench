import React, { useEffect, useMemo, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel.jsx';
import QuickInfoSection from '../../../QuickInfoSection.jsx';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import AggregateLogsTab from '../../../components/AggregateLogsTab.jsx';
import ServiceTasksTab from './ServiceTasksTab.jsx';
import SwarmResourceActions from '../SwarmResourceActions.jsx';
import UpdateServiceImageModal from './UpdateServiceImageModal.jsx';
import ImageUpdateBadge from './ImageUpdateBadge.jsx';
import ImageUpdateModal from './ImageUpdateModal.jsx';
import ImageUpdateSettingsModal from './ImageUpdateSettingsModal.jsx';
import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
import { AnalyzeSwarmServiceStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
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
  {
    key: 'imageUpdate',
    label: 'Update',
    cell: ({ getValue }) => {
      const v = getValue();
      return <ImageUpdateBadge value={v} onOpenDetails={v?.onOpenDetails} />;
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
  { key: 'holmes', label: 'Holmes' },
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

function _splitEnvKey(env) {
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

function renderPanelContent(row, tab, onRefresh, holmesState, onAnalyze, onCancel) {
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

  if (tab === 'holmes') {
    const key = `swarm/${row.id}`;
    return (
      <HolmesBottomPanel
        kind="Swarm Service"
        namespace="swarm"
        name={row.name}
        onAnalyze={() => onAnalyze(row)}
        onCancel={holmesState.key === key && holmesState.streamId ? onCancel : null}
        response={holmesState.key === key ? holmesState.response : null}
        loading={holmesState.key === key && holmesState.loading}
        error={holmesState.key === key ? holmesState.error : null}
        queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
        streamingText={holmesState.key === key ? holmesState.streamingText : ''}
        reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
        toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
        contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
      />
    );
  }

  return null;
}

function decorateServiceRows(list) {
  const items = Array.isArray(list) ? list : [];
  return items.map((s) => {
    return {
      ...s,
      imageUpdate: {
        serviceId: s?.id,
        serviceName: s?.name,
        image: s?.image,
        imageUpdateAvailable: s?.imageUpdateAvailable,
        imageLocalDigest: s?.imageLocalDigest,
        imageRemoteDigest: s?.imageRemoteDigest,
        imageCheckedAt: s?.imageCheckedAt,
      },
    };
  });
}

function mergeImageUpdateMap(prev, updates) {
  if (!updates || typeof updates !== 'object') return prev;
  if (!Array.isArray(prev)) return prev;

  return prev.map((s) => {
    const id = s?.id;
    if (!id) return s;
    const u = updates[id];
    if (!u) return s;

    const imageUpdateAvailable = Boolean(u?.updateAvailable);
    const imageLocalDigest = String(u?.localDigest || '').trim();
    const imageRemoteDigest = String(u?.remoteDigest || '').trim();
    const imageCheckedAt = String(u?.checkedAt || '').trim();

    return {
      ...s,
      imageUpdateAvailable,
      imageLocalDigest,
      imageRemoteDigest,
      imageCheckedAt,
      imageUpdate: {
        ...(s.imageUpdate || {}),
        imageUpdateAvailable,
        imageLocalDigest,
        imageRemoteDigest,
        imageCheckedAt,
      },
    };
  });
}

export default function SwarmServicesOverviewTable() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [imageUpdateServiceId, setImageUpdateServiceId] = useState(null);
  const [imageUpdateSettingsOpen, setImageUpdateSettingsOpen] = useState(false);
  const [holmesState, setHolmesState] = useState({
    loading: false,
    response: null,
    error: null,
    key: null,
    streamId: null,
    streamingText: '',
    reasoningText: '',
    queryTimestamp: null,
    contextSteps: [],
    toolEvents: [],
  });
  const holmesStateRef = React.useRef(holmesState);
  React.useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const promptReplicas = (current) => {
    const value = window.prompt('Scale to replicas', String(current ?? 0));
    if (value === null) return null;
    const next = Number(String(value).trim());
    if (!Number.isFinite(next) || next < 0) return null;
    return Math.round(next);
  };

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const data = await GetSwarmServices();
        if (active) {
          setServices(decorateServiceRows(data || []));
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
        setServices(decorateServiceRows(data));
      } else if (active) {
        refresh();
      }
    });

    const offUpdates = EventsOn('swarm:image:updates', (updates) => {
      if (!active) return;
      setServices((prev) => mergeImageUpdateMap(prev, updates));
    });

    return () => {
      active = false;
      if (typeof off === 'function') off();
      if (typeof offUpdates === 'function') offUpdates();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      if (!payload) return;
      const current = holmesStateRef.current;
      const { streamId } = current;
      if (payload.stream_id && streamId && payload.stream_id !== streamId) {
        return;
      }
      if (payload.error) {
        if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
          setHolmesState((prev) => ({ ...prev, loading: false }));
          return;
        }
        setHolmesState((prev) => ({ ...prev, loading: false, error: payload.error }));
        return;
      }

      const eventType = payload.event;
      if (!payload.data) {
        return;
      }

      let data;
      try {
        data = JSON.parse(payload.data);
      } catch {
        data = null;
      }

      if (eventType === 'ai_message' && data) {
        let handled = false;
        if (data.reasoning) {
          setHolmesState((prev) => ({
            ...prev,
            reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + data.reasoning,
          }));
          handled = true;
        }
        if (data.content) {
          setHolmesState((prev) => {
            const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + data.content;
            return { ...prev, streamingText: nextText, response: { response: nextText } };
          });
          handled = true;
        }
        if (handled) return;
      }

      if (eventType === 'start_tool_calling' && data && data.id) {
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: [...(prev.toolEvents || []), {
            id: data.id,
            name: data.tool_name || 'tool',
            status: 'running',
            description: data.description,
          }],
        }));
        return;
      }

      if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
        const status = data.result?.status || data.status || 'done';
        setHolmesState((prev) => ({
          ...prev,
          toolEvents: (prev.toolEvents || []).map((item) =>
            item.id === data.tool_call_id
              ? { ...item, status, description: data.description || item.description }
              : item
          ),
        }));
        return;
      }

      if (eventType === 'ai_answer_end' && data && data.analysis) {
        setHolmesState((prev) => ({
          ...prev,
          loading: false,
          response: { response: data.analysis },
          streamingText: data.analysis,
        }));
        return;
      }

      if (eventType === 'stream_end') {
        setHolmesState((prev) => {
          if (prev.streamingText) {
            return { ...prev, loading: false, response: { response: prev.streamingText } };
          }
          return { ...prev, loading: false };
        });
      }
    });
    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event) => {
      if (!event?.key) return;
      setHolmesState((prev) => {
        if (prev.key !== event.key) return prev;
        const id = event.step || 'step';
        const nextSteps = Array.isArray(prev.contextSteps) ? [...prev.contextSteps] : [];
        const idx = nextSteps.findIndex((item) => item.id === id);
        const entry = {
          id,
          step: event.step,
          status: event.status || 'running',
          detail: event.detail || '',
        };
        if (idx >= 0) {
          nextSteps[idx] = { ...nextSteps[idx], ...entry };
        } else {
          nextSteps.push(entry);
        }
        return { ...prev, contextSteps: nextSteps };
      });
    });
    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

  const serviceForUpdateModal = useMemo(() => {
    if (!imageUpdateServiceId) return null;
    return (services || []).find((s) => s?.id === imageUpdateServiceId) || null;
  }, [services, imageUpdateServiceId]);

  const servicesWithHandlers = useMemo(() => {
    return (services || []).map((s) => ({
      ...s,
      imageUpdate: {
        ...(s.imageUpdate || {}),
        onOpenDetails: (serviceId) => setImageUpdateServiceId(serviceId),
      },
    }));
  }, [services]);

  if (loading) {
    return <div className="main-panel-loading">Loading Swarm services...</div>;
  }

  const analyzeWithHolmes = async (service) => {
    const key = service?.id;
    if (!key) return;
    const streamId = `swarm-service-${Date.now()}`;
    setHolmesState({
      loading: true,
      response: null,
      error: null,
      key: `swarm/${key}`,
      streamId,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
      toolEvents: [],
    });
    try {
      await AnalyzeSwarmServiceStream(service.id, streamId);
    } catch (err) {
      const message = err?.message || String(err);
      setHolmesState((prev) => ({
        ...prev,
        loading: false,
        response: null,
        error: message,
      }));
      showError(`Holmes analysis failed: ${message}`);
    }
  };

  const cancelHolmesAnalysis = async () => {
    const currentStreamId = holmesState.streamId;
    if (!currentStreamId) return;
    setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      console.error('Failed to cancel Holmes stream:', err);
    }
  };

  return (
    <>
      <OverviewTableWithPanel
        title="Swarm Services"
        columns={columns}
        data={servicesWithHandlers}
        tabs={bottomTabs}
        renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh, holmesState, analyzeWithHolmes, cancelHolmesAnalysis)}
        tableTestId="swarm-services-table"
        createPlatform="swarm"
        createKind="service"
        getRowActions={(row, api) => {
          const canScale = (row?.mode || '').toLowerCase() === 'replicated';
          const isAnalyzing = holmesState.loading && holmesState.key === `swarm/${row.id}`;
          return [
            {
              label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
              icon: '🧠',
              disabled: isAnalyzing,
              onClick: () => {
                analyzeWithHolmes(row);
                api?.openDetails?.('holmes');
              },
            },
            {
              label: 'Restart',
              icon: '🔄',
              onClick: async () => {
                try {
                  await RestartSwarmService(row.id);
                  showSuccess(`Restarted service ${row.name}`);
                  refresh();
                } catch (err) {
                  showError(`Failed to restart service: ${err}`);
                }
              },
            },
            {
              label: 'Scale…',
              icon: '📏',
              disabled: !canScale,
              onClick: async () => {
                if (!canScale) return;
                const desired = promptReplicas(row?.replicas ?? 0);
                if (desired === null) return;
                try {
                  await ScaleSwarmService(row.id, desired);
                  showSuccess(`Scaled service ${row.name} to ${desired} replicas`);
                  refresh();
                } catch (err) {
                  showError(`Failed to scale service: ${err}`);
                }
              },
            },
            {
              label: 'Delete',
              icon: '🗑️',
              danger: true,
              onClick: async () => {
                if (!window.confirm(`Delete service "${row.name}"?`)) return;
                try {
                  await RemoveSwarmService(row.id);
                  showSuccess(`Removed service ${row.name}`);
                  refresh();
                } catch (err) {
                  showError(`Failed to remove service: ${err}`);
                }
              },
            },
          ];
        }}
        headerActions={
          <button
            id="swarm-image-update-settings-btn"
            type="button"
            onClick={() => setImageUpdateSettingsOpen(true)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--gh-border, #30363d)',
              backgroundColor: 'var(--gh-button-bg, #21262d)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              marginRight: 8,
            }}
            title="Image update detection settings"
          >
            Image Updates
          </button>
        }
      />

      <ImageUpdateModal
        open={Boolean(imageUpdateServiceId)}
        service={serviceForUpdateModal}
        onClose={() => setImageUpdateServiceId(null)}
      />

      <ImageUpdateSettingsModal
        open={imageUpdateSettingsOpen}
        onClose={() => setImageUpdateSettingsOpen(false)}
      />
    </>
  );
}
