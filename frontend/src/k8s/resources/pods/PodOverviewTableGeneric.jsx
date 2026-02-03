/**
 * PodOverviewTableGeneric
 *
 * Migrated Pods table using GenericResourceTable component.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { podConfig, normalizePod, renderPodPanelContent } from '../../../config/resourceConfigs/podConfig';
import PortForwardDialog from './PortForwardDialog';
import StatusBadge from '../../../components/StatusBadge';
import { showError, showSuccess } from '../../../notification';

export default function PodOverviewTableGeneric({ namespace, namespaces }) {
  const [now, setNow] = useState(() => Date.now());
  const [showPFDialog, setShowPFDialog] = useState(false);
  const [pfDialogPod, setPfDialogPod] = useState(null);
  const [pfDialogNamespace, setPfDialogNamespace] = useState(null);
  const [forwardLocalPort, setForwardLocalPort] = useState(null);
  const [forwardRemotePort, setForwardRemotePort] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = useCallback((startTime) => {
    if (!startTime) return '-';
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return '-';
    let diff = Math.floor((now - start) / 1000);
    if (diff < 0) diff = 0;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s}s`;
  }, [now]);

  const renderPortsCell = useCallback((ports) => {
    if (!Array.isArray(ports) || ports.length === 0) return '-';
    const sorted = [...ports].sort((a, b) => a - b);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sorted.map((p) => (
          <code key={p} style={{ background: 'rgba(99,110,123,0.2)', padding: '2px 6px', borderRadius: 0, border: '1px solid #353a42' }}>
            {p}
          </code>
        ))}
      </div>
    );
  }, []);

  const columns = useMemo(() => ([
    { key: 'name', label: 'Name' },
    { key: 'namespace', label: 'Namespace' },
    {
      key: 'status',
      label: 'Status',
      cell: (info) => <StatusBadge status={info.getValue() || '-'} size="small" />,
    },
    {
      key: 'ports',
      label: 'Ports',
      cell: (info) => renderPortsCell(info.getValue()),
    },
    { key: 'restarts', label: 'Restarts' },
    {
      key: 'startTime',
      label: 'Uptime',
      cell: (info) => formatUptime(info.getValue()),
    },
  ]), [formatUptime, renderPortsCell]);

  const ensureNamespace = useCallback(async (ns) => {
    if (!ns) return;
    try {
      await AppAPI.SetCurrentNamespace(ns);
    } catch (_) {
      // ignore
    }
  }, []);

  const handleShell = useCallback(async (row, api) => {
    await ensureNamespace(row.namespace || namespace);
    api?.openDetails?.('console');
  }, [ensureNamespace, namespace]);

  const handlePortForward = useCallback(async (row, api) => {
    const ns = row.namespace || namespace;
    await ensureNamespace(ns);
    setPfDialogPod(row.name);
    setPfDialogNamespace(ns);
    setShowPFDialog(true);
    api?.openDetails?.('portforward');
    showSuccess(`Configure port-forward for ${row.name}…`);
  }, [ensureNamespace, namespace]);

  const handleConfirmPortForward = useCallback(async ({ sourcePort, targetPort }) => {
    const podName = pfDialogPod;
    const ns = pfDialogNamespace || namespace;
    setShowPFDialog(false);
    if (!podName || !ns) return;

    try {
      setForwardLocalPort(targetPort);
      setForwardRemotePort(sourcePort);
      showSuccess(`Starting port-forward to ${podName}: ${targetPort} -> ${sourcePort} ...`);
      if (typeof AppAPI.PortForwardPodWith === 'function') {
        await AppAPI.PortForwardPodWith(ns, podName, targetPort, sourcePort);
      } else {
        await AppAPI.PortForwardPod(ns, podName, sourcePort);
      }
    } catch (err) {
      showError(`Failed to start port-forward for pod '${podName}': ${err?.message || err}`);
    }
  }, [pfDialogPod, pfDialogNamespace, namespace]);

  const handleStopPortForward = useCallback(async (row) => {
    const ns = row.namespace || namespace;
    let portToStop = null;

    const input = window.prompt('Enter local port to stop forwarding:', '20000');
    if (input == null) return;
    const p = parseInt(String(input).trim(), 10);
    if (!Number.isFinite(p) || p <= 0 || p > 65535) {
      showError(`Invalid port: ${input}`);
      return;
    }
    portToStop = p;

    try {
      await AppAPI.StopPortForward(ns, row.name, portToStop);
      showSuccess(`Stopped port-forward for ${row.name}:${portToStop}.`);
    } catch (err) {
      showError(`Failed to stop port-forward for '${row.name}': ${err?.message || err}`);
    }
  }, [namespace]);

  const getRowActions = useCallback((row, api) => ([
    {
      label: 'Shell',
      icon: '💻',
      onClick: () => handleShell(row, api),
    },
    {
      label: 'Port Forward',
      icon: '🔀',
      onClick: () => handlePortForward(row, api),
    },
    {
      label: 'Stop Port Forward',
      icon: '⏹️',
      onClick: () => handleStopPortForward(row),
    },
  ]), [handleShell, handlePortForward, handleStopPortForward]);

  const renderPanelContent = useCallback((row, tab, holmesState, onAnalyze, onCancel, panelApi, data) => (
    renderPodPanelContent(row, tab, holmesState, onAnalyze, onCancel, panelApi, data, {
      forwardLocalPort,
      forwardRemotePort,
    })
  ), [forwardLocalPort, forwardRemotePort]);

  const normalizeWithNamespace = useCallback((pod) => normalizePod(pod, namespace), [namespace]);

  return (
    <>
      <GenericResourceTable
        {...podConfig}
        columns={columns}
        renderPanelContent={renderPanelContent}
        getRowActions={getRowActions}
        namespaces={namespaces}
        namespace={namespace}
        normalize={normalizeWithNamespace}
      />
      <PortForwardDialog
        open={showPFDialog}
        podName={pfDialogPod}
        onCancel={() => setShowPFDialog(false)}
        onConfirm={handleConfirmPortForward}
      />
    </>
  );
}
