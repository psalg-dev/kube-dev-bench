/**
 * TaskSummaryPanel Component
 * 
 * Summary panel for Swarm task details.
 */

import { useState, useEffect } from 'react';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../../QuickInfoSection';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import StatusBadge from '../../../components/StatusBadge';
import HealthStatusBadge from './HealthStatusBadge';
import { GetSwarmTaskLogs, GetSwarmTaskHealthLogs } from '../../swarmApi';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';

function formatMount(m) {
  if (!m) return '-';
  const type = m.type || 'mount';
  const src = m.source || '-';
  const tgt = m.target || '-';
  const ro = m.readOnly ? ' (ro)' : '';
  return `${type}:${src} -> ${tgt}${ro}`;
}

const quickInfoFields = [
  { key: 'id', label: 'Task ID', type: 'break-word' },
  { key: 'serviceId', label: 'Service ID', type: 'break-word' },
  { key: 'serviceName', label: 'Service Name' },
  { key: 'nodeId', label: 'Node ID', type: 'break-word' },
  { key: 'nodeName', label: 'Node Name' },
  { key: 'slot', label: 'Slot' },
  {
    key: 'state',
    label: 'State',
    type: 'status',
    layout: 'flex',
    rightField: { key: 'desiredState', label: 'Desired State', type: 'status' }
  },
  { key: 'healthStatus', label: 'Health', type: 'status', getValue: (d) => d.healthStatus || 'none' },
  { key: 'containerId', label: 'Container ID', type: 'break-word' },
  { key: 'image', label: 'Image', type: 'break-word' },
  {
    key: 'networks',
    label: 'Networks',
    type: 'list',
    getValue: (d) => {
      const nets = Array.isArray(d.networks) ? d.networks : [];
      return nets.flatMap((n) => {
        const id = n.networkId ? `${String(n.networkId).slice(0, 12)}...` : 'unknown';
        const addrs = Array.isArray(n.addresses) ? n.addresses : [];
        if (!addrs.length) return [`${id}`];
        return addrs.map((a) => `${id}: ${a}`);
      });
    },
  },
  {
    key: 'mounts',
    label: 'Mounts',
    type: 'list',
    getValue: (d) => (Array.isArray(d.mounts) ? d.mounts : []).map(formatMount),
  },
  { key: 'error', label: 'Error', type: 'break-word' },
  { key: 'createdAt', label: 'Created', type: 'date' },
  { key: 'updatedAt', label: 'Updated', type: 'date' },
];

function TaskInfoPanel({ row }) {
  const [logs, setLogs] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const STATUS_LABELS = new Set(['Current State', 'Desired State', 'Health Status']);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!row?.id) return;
      setLoadingLogs(true);
      try {
        const data = await GetSwarmTaskHealthLogs(row.id);
        if (!active) return;
        setLogs(Array.isArray(data) ? data : []);
      } catch (_e) {
        if (!active) return;
        setLogs([]);
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        if (!active) return;
        setLoadingLogs(false);
      }
    };

    if (row?.containerId) {
      load();
    } else {
      setLogs([]);
    }

    return () => {
      active = false;
    };
  }, [row?.id, row?.containerId]);

  const hc = row?.healthCheck;
  const hasHc = !!hc && Array.isArray(hc.test) && hc.test.length > 0;
  const hasTimeline = row?.createdAt || row?.updatedAt || row?.state || row?.desiredState;

  if (!hasTimeline && !hasHc) {
    return null;
  }

  const infoItems = [];

  if (row?.createdAt) {
    infoItems.push({ label: 'Created', value: formatTimestampDMYHMS(row.createdAt) });
  }
  if (row?.updatedAt) {
    infoItems.push({ label: 'Updated', value: formatTimestampDMYHMS(row.updatedAt) });
  }
  if (row?.state) {
    infoItems.push({ label: 'Current State', value: row.state });
  }
  if (row?.desiredState) {
    infoItems.push({ label: 'Desired State', value: row.desiredState });
  }

  infoItems.push({ label: 'Health Status', value: row?.healthStatus || 'none' });
  infoItems.push({ label: 'Health Config', value: hasHc ? 'Configured' : 'Not configured' });
  if (hasHc) {
    infoItems.push({ label: 'Health Test', value: hc.test.join(' '), breakWord: true });
    if (hc.retries != null) {
      infoItems.push({ label: 'Retries', value: String(hc.retries) });
    }
    if (hc.interval) {
      infoItems.push({ label: 'Interval', value: hc.interval });
    }
    if (hc.timeout) {
      infoItems.push({ label: 'Timeout', value: hc.timeout });
    }
    if (hc.startPeriod) {
      infoItems.push({ label: 'Start Period', value: hc.startPeriod });
    }
  }

  if (infoItems.length === 0) {
    return null;
  }

  return (
    <div style={{
      width: 320,
      minWidth: 260,
      borderLeft: '1px solid #30363d',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      textAlign: 'left',
    }}>
      <div style={{
        height: 44,
        padding: '0 12px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontWeight: 600,
        textAlign: 'left',
        background: '#161b22',
        color: '#d4d4d4',
      }}>
        Details
      </div>
      <div style={{
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 10,
        flex: 1,
        overflow: 'auto',
        textAlign: 'left',
        color: '#d4d4d4',
      }}>
        {infoItems.map((item, idx) => {
          const isStatus = STATUS_LABELS.has(item.label);
          return (
            <div key={idx} style={{ fontSize: 12, display: 'grid', gap: 4 }}>
              <div style={{ color: '#858585' }}>{item.label}</div>
              <div style={{
                color: '#d4d4d4',
                wordBreak: item.breakWord ? 'break-word' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'flex-start',
                textAlign: 'left',
              }}>
                {isStatus ? (
                  <StatusBadge status={item.value || '-'} size="small" showDot={false} />
                ) : (
                  item.value
                )}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#d4d4d4' }}>
            Health Check
          </div>
          <div style={{ fontSize: 12, color: '#858585', marginBottom: 10 }}>
            {hasHc ? 'Configured' : 'Not configured'}
          </div>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#d4d4d4' }}>
            Recent Results
          </div>
          {loadingLogs ? (
            <div style={{ fontSize: 12, color: '#858585' }}>Loading…</div>
          ) : !logs || logs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#858585' }}>No health check results.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {logs.slice(-4).map((l, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #30363d',
                    padding: '6px 8px',
                    fontSize: 11,
                    color: '#858585',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <div>Exit {l.exitCode}</div>
                    <div style={{ fontSize: 10 }}>{l.end ? formatTimestampDMYHMS(l.end) : '-'}</div>
                  </div>
                  {l.output ? (
                    <div style={{ marginTop: 4, color: '#d4d4d4', whiteSpace: 'pre-wrap', fontSize: 10 }}>{l.output}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskSummaryPanel({ row, panelApi }) {
  const onExec = () => panelApi?.setActiveTab && panelApi.setActiveTab('exec');

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader
        name={`Task: ${row.id?.substring(0, 12) || 'unknown'}`}
        actions={(
          <button
            onClick={onExec}
            disabled={!row?.containerId || (row?.state || '').toLowerCase() !== 'running'}
            title={
              !row?.containerId
                ? 'No container associated with this task yet'
                : (row?.state || '').toLowerCase() !== 'running'
                  ? 'Exec is only available for running tasks'
                  : 'Open interactive exec'
            }
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--gh-border, #30363d)',
              background: 'var(--gh-bg, #0d1117)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: (!row?.containerId || (row?.state || '').toLowerCase() !== 'running') ? 'not-allowed' : 'pointer',
              opacity: (!row?.containerId || (row?.state || '').toLowerCase() !== 'running') ? 0.5 : 1,
            }}
          >
            Exec
          </button>
        )}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row.id}
          data={row}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {row.containerId ? (
              <AggregateLogsTab
                title="Task Logs (preview)"
                reloadKey={row.id}
                loadLogs={() => GetSwarmTaskLogs(row.id, '100')}
              />
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
                No container associated with this task yet.
              </div>
            )}
          </div>
        </div>
        <TaskInfoPanel row={row} />
      </div>
    </div>
  );
}
