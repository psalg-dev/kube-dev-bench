/**
 * ServiceSummaryPanel Component
 * 
 * Summary panel for Swarm service details with action buttons and modals.
 * This is a stateful wrapper that manages modal visibility for Update Image functionality.
 */

import { useState } from 'react';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../../QuickInfoSection';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import SwarmResourceActions from '../SwarmResourceActions';
import UpdateServiceImageModal from './UpdateServiceImageModal';
import {
  GetSwarmServiceLogs,
  ScaleSwarmService,
  RemoveSwarmService,
  RestartSwarmService,
  UpdateSwarmServiceImage,
} from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';

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

export default function ServiceSummaryPanel({ row, panelApi }) {
  const [showUpdateImage, setShowUpdateImage] = useState(false);

  const handleScale = async (newReplicas) => {
    try {
      await ScaleSwarmService(row.id, newReplicas);
      showSuccess(`Scaled service ${row.name} to ${newReplicas} replicas`);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to scale service: ${err}`);
    }
  };

  const handleRestart = async () => {
    try {
      await RestartSwarmService(row.id);
      showSuccess(`Restarted service ${row.name}`);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to restart service: ${err}`);
    }
  };

  const handleDelete = async () => {
    try {
      await RemoveSwarmService(row.id);
      showSuccess(`Removed service ${row.name}`);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to remove service: ${err}`);
    }
  };

  const handleUpdateImage = async (newImage) => {
    try {
      await UpdateSwarmServiceImage(row.id, newImage);
      showSuccess(`Updated service ${row.name} image`);
      setShowUpdateImage(false);
      panelApi?.refresh?.();
    } catch (err) {
      showError(`Failed to update service image: ${err}`);
    }
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
