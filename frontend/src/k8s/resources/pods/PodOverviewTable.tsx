import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type UIEvent as ReactUIEvent } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../../../wailsjs/runtime';
import LogViewerTab from '../../../layout/bottompanel/LogViewerTab';
import PodSummaryTab from './PodSummaryTab';
import PodEventsTab from './PodEventsTab';
import PodYamlTab from './PodYamlTab';
import ConsoleTab from '../../../layout/bottompanel/ConsoleTab';
import PortForwardOutput from './PortForwardOutput';
import BottomPanel from '../../../layout/bottompanel/BottomPanel';
import PortForwardDialog from './PortForwardDialog';
import PodMountsTab from './PodMountsTab';
import PodFilesTab from './PodFilesTab';
import '../../../layout/overview/OverviewTableWithPanel.css';
import '../../../layout/overview/BulkSelection.css';
import { showResourceOverlay } from '../../../resource-overlay';
import { AnalyzePodStream, onHolmesContextProgress, onHolmesChatStream, CancelHolmesStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse } from '../../../holmes/HolmesResponseRenderer';
import StatusBadge from '../../../components/StatusBadge';
import BulkActionBar from '../../../components/BulkActionBar';
import useTableSelection from '../../../hooks/useTableSelection';
import { getBulkActionsForResource, type BulkAction } from '../../../constants/bulkActions';
import { executeBulkAction } from '../../../api/bulkOperations';
import { showError, showSuccess } from '../../../notification';
import type { app } from '../../../../wailsjs/go/models';

// Resource types matching sidebar and templates in resource-overlay
const createOptions = [
  { key: 'deployment', label: 'Deployment' },
  { key: 'job', label: 'Job' },
  { key: 'cronjob', label: 'CronJob' },
  { key: 'daemonset', label: 'DaemonSet' },
  { key: 'statefulset', label: 'StatefulSet' },
  { key: 'replicaset', label: 'ReplicaSet' },
  { key: 'configmap', label: 'ConfigMap' },
  { key: 'secret', label: 'Secret' },
  { key: 'ingress', label: 'Ingress' },
];

type PodOverviewTableProps = {
  namespace?: string;
  namespaces?: string[];
  data?: PodRow[];
  loading?: boolean;
  onCreateResource?: (type?: string) => void;
};

type HolmesState = {
  loading: boolean;
  response: HolmesResponse | null;
  error: string | null;
  key: string | null;
  streamId: string | null;
  streamingText: string;
  reasoningText: string;
  queryTimestamp: string | null;
  contextSteps: HolmesContextStep[];
  toolEvents: HolmesToolEvent[];
};

type PodRow = app.PodInfo & {
  Name?: string;
  Namespace?: string;
  Restarts?: number;
  Uptime?: string;
  Age?: string;
  age?: string;
  Phase?: string;
  Ports?: number[];
  Labels?: Record<string, string>;
  labels?: Record<string, string>;
  status?: string;
  Status?: string;
  phase?: string;
};

type PortForwardInfoRaw = app.PortForwardInfo & {
  Namespace?: string;
  Pod?: string;
  Local?: number;
  Remote?: number;
};

type PortForwardMap = Record<string, Record<number, number[]>>;

export default function PodOverviewTable({
  namespace,
  namespaces = [],
  data = [],
  loading = false,
  onCreateResource,
}: PodOverviewTableProps) {
  const [now, setNow] = useState(Date.now());
  // Default sorting: uptime ascending (youngest at top)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'uptime', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomPodName, setBottomPodName] = useState<string | null>(null);
  const [bottomNamespace, setBottomNamespace] = useState<string | null>(null);
  const [bottomActiveTab, setBottomActiveTab] = useState('summary');
  const [showMenu, setShowMenu] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: string }>({ message: '', type: '' });
  const [showPFDialog, setShowPFDialog] = useState(false);
  const [pfDialogPod, setPfDialogPod] = useState<string | null>(null);
  const [forwardLocalPort, setForwardLocalPort] = useState<number | null>(null);
  const [forwardRemotePort, setForwardRemotePort] = useState<number | null>(null);
  const [internalData, setInternalData] = useState<PodRow[]>([]);
  const [pfByKey, setPfByKey] = useState<PortForwardMap>({}); // key: ns/pod -> { remotePort: [locals] }
  const bulkActions = useMemo(() => getBulkActionsForResource({ platform: 'k8s', kind: 'pod' }), []);
  const bulkEnabled = bulkActions.length > 0;
  const [holmesState, setHolmesState] = useState<HolmesState>({
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
  const holmesStateRef = useRef<HolmesState>(holmesState);
  useEffect(() => {
    holmesStateRef.current = holmesState;
  }, [holmesState]);

  // Subscribe to Holmes chat stream events
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
        setHolmesState((prev) => ({ ...prev, loading: false, error: payload.error ?? null }));
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

  const multiNs = Array.isArray(namespaces) && namespaces.length > 1;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const normalizePod = (pod: PodRow, ns?: string): PodRow => {
    const name = pod?.name ?? pod?.Name;
    const namespaceVal = pod?.namespace ?? pod?.Namespace ?? ns;
    return {
      ...pod,
      name,
      namespace: namespaceVal,
      restarts: pod?.restarts ?? pod?.Restarts ?? 0,
      uptime: pod?.uptime ?? pod?.Uptime ?? pod?.age ?? pod?.Age ?? '-',
      status: pod?.status ?? pod?.Status ?? pod?.phase ?? pod?.Phase ?? '-',
      ports: pod?.ports ?? pod?.Ports ?? [],
    };
  };

  const refreshPods = useCallback(async () => {
    const selected = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : [namespace];
    const targetNamespaces = selected.filter((value): value is string => Boolean(value));
    if (targetNamespaces.length === 0) return;

    try {
      const results = await Promise.all(
        targetNamespaces.map(async (ns) => {
          const pods = await AppAPI.GetRunningPods(ns);
          return (Array.isArray(pods) ? (pods as PodRow[]) : []).map((p) => normalizePod(p, ns));
        })
      );
      const combined = results.flat();
      if (mountedRef.current) {
        setInternalData(combined);
      }
    } catch (_) {
      // Best-effort refresh; keep existing list on failure to avoid flicker.
    }
  }, [namespace, namespaces]);

  // Fallback: subscribe to pods:update if parent doesn't pass data
  useEffect(() => {
    const handler = (pods: PodRow[] | null | undefined) => {
      setInternalData(Array.isArray(pods) ? (pods as PodRow[]) : []);
    };
    EventsOn('pods:update', handler);
    return () => {
      try { EventsOff('pods:update'); } catch (_) {}
    };
  }, []);

  // React to generic resource-updated events emitted by CreateManifestOverlay.
  // This makes newly created Pods appear quickly without waiting for background polling.
  useEffect(() => {
    const onUpdate = (eventData: { resource?: string; namespace?: string } | null | undefined) => {
      const res = (eventData?.resource || '').toString().toLowerCase();
      if (res !== 'pod' && res !== 'pods') return;
      const ns = (eventData?.namespace || '').toString();
      const selected = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : [namespace];
      if (ns && !selected.includes(ns)) return;
      refreshPods();
    };

    const unsubscribe = EventsOn('resource-updated', onUpdate);
    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, [namespace, namespaces, refreshPods]);

  // Initial load when this view mounts or namespaces change.
  useEffect(() => {
    refreshPods();
  }, [refreshPods]);

  // Subscribe to consolidated portforward updates and seed initial state
  useEffect(() => {
    function buildMap(list: PortForwardInfoRaw[] | null | undefined): PortForwardMap {
      const map: PortForwardMap = {};
      if (Array.isArray(list)) {
        for (const item of list) {
          if (!item) continue;
          const ns = item.namespace || item.Namespace; // tolerate different casings
          const pod = item.pod || item.Pod;
          const local = item.local ?? item.Local;
          const remote = item.remote ?? item.Remote;
          if (!ns || !pod || !Number.isFinite(local) || !Number.isFinite(remote)) continue;
          const key = `${ns}/${pod}`;
          if (!map[key]) map[key] = {};
          if (!map[key][remote]) map[key][remote] = [];
          if (!map[key][remote].includes(local)) map[key][remote].push(local);
        }
      }
      return map;
    }
    const onUpdate = (list: PortForwardInfoRaw[] | null | undefined) => setPfByKey(buildMap(list));
    EventsOn('portforwards:update', onUpdate);
    const maybeFetch = async () => {
      try {
        const list = await AppAPI.ListPortForwards();
        onUpdate(list as PortForwardInfoRaw[]);
      } catch (_) {}
    };
    maybeFetch();
    return () => { try { EventsOff('portforwards:update'); } catch (_) {} };
  }, []);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // ensure backend current namespace aligns with the row we're operating on
  async function ensureNamespace(ns?: string) {
    if (!ns) return;
    try { await AppAPI.SetCurrentNamespace(ns); } catch (_) {}
  }

  useEffect(() => {
    setColumnFilters([{ id: 'name', value: filterValue }]);
  }, [filterValue]);

  // Close row context menu on click outside, focus change, Escape key, or window blur
  useEffect(() => {
    if (openMenuIndex === null) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.menu-content') || target?.closest('.row-actions-button')) return;
      setOpenMenuIndex(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuIndex(null);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.menu-content') || target?.closest('.row-actions-button')) return;
      setOpenMenuIndex(null);
    };

    const handleWindowBlur = () => {
      setOpenMenuIndex(null);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [openMenuIndex]);

  // Handle escape key and click-outside for bottom panel
  useEffect(() => {
    if (!bottomOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't close if we're resizing or if the click is within the bottom panel
      if (target?.closest('.bottom-panel') ||
          target?.closest('[data-resizing]') ||
          document.body.style.cursor === 'ns-resize') {
        return;
      }
      closeBottomPanel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeBottomPanel();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bottomOpen]);

  function handleMenuClick(e: ReactMouseEvent) {
    e.stopPropagation();
  }

  function formatUptime(startTime?: string) {
    if (!startTime) return '-';
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return '-';
    let diff = Math.floor((now - start) / 1000);
    if (diff < 0) diff = 0;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
  }

  function renderPortsCell(pod: PodRow) {
    const ports = pod?.ports || [];
    if (!ports || ports.length === 0) return '-';
    const key = `${pod.namespace || ''}/${pod.name}`;
    const fForPod = pfByKey[key] || {};
    const sorted = [...ports].sort((a, b) => a - b);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sorted.map((p) => {
          const locals = fForPod[p] || [];
          const hasFwd = locals.length > 0;
          return (
            <span key={p} title={hasFwd ? `Forwarded to: ${locals.join(', ')}` : ''} style={{ whiteSpace: 'nowrap' }}>
              <code style={{ background: 'rgba(99,110,123,0.2)', padding: '2px 6px', borderRadius: 0, border: '1px solid #353a42' }}>{p}</code>
              {hasFwd && (
                <>
                  <span style={{ margin: '0 4px', color: '#aaa' }}>→</span>
                  <code style={{ background: 'rgba(35,134,54,0.15)', padding: '2px 6px', borderRadius: 0, border: '1px solid rgba(35,134,54,0.4)', color: 'var(--gh-accent, #2ea44f)' }}>
                    {locals.join(', ')}
                  </code>
                  <span aria-label="forward active" title="Port-forward active" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--gh-accent, #2ea44f)', marginLeft: 6, verticalAlign: 'middle' }} />
                </>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  function renderStatusCell(pod: PodRow) {
    const status = pod.status || pod.phase || '-';
    if (!status || status === '-') {
      return '-';
    }
    const label = typeof status === 'string' ? status : String(status);
    return <StatusBadge status={label} size="small" />;
  }

  const baseColumns = useMemo<ColumnDef<PodRow, unknown>[]>(() => {
    const cols: ColumnDef<PodRow, unknown>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        filterFn: 'includesString',
        cell: (info) => info.getValue(),
      },
    ];

    if (multiNs) {
      cols.push({
        accessorKey: 'namespace',
        header: 'Namespace',
        cell: (info) => info.getValue(),
      });
    }

    cols.push(
      {
        id: 'status',
        header: 'Status',
        cell: (info) => renderStatusCell(info.row.original),
        enableSorting: false,
      },
      {
        id: 'ports',
        header: 'Ports',
        cell: (info) => renderPortsCell(info.row.original),
        enableSorting: false,
      },
      {
        accessorKey: 'restarts',
        header: 'Restarts',
        cell: (info) => info.getValue() || 0,
        sortingFn: (a, b) => (a.original.restarts || 0) - (b.original.restarts || 0),
      },
      {
        accessorKey: 'uptime',
        header: 'Uptime',
        cell: (info) => formatUptime(info.row.original.startTime),
        sortingFn: (a, b) => new Date(b.original.startTime || 0).getTime() - new Date(a.original.startTime || 0).getTime(),
      }
    );

    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, pfByKey, multiNs]);

  const tableData: PodRow[] = (Array.isArray(data) && data.length > 0) ? data : internalData;
  const table = useReactTable<PodRow>({
    data: tableData,
    columns: baseColumns,
    state: {
      sorting,
      pagination,
      columnFilters,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: false,
    manualSorting: false,
  });

  const getRowKey = useCallback((row: PodRow, idx: number) => {
    // Use UID for unique keys, fallback to namespace + name + status plus index
    // to guarantee uniqueness when UIDs are unavailable.
    const uid = row?.uid ?? (row as { UID?: string }).UID ?? '';
    if (uid) {
      return uid;
    }
    const ns = row?.namespace ?? row?.Namespace ?? namespace ?? '';
    const rowRecord = row as unknown as Record<string, unknown>;
    const name = row?.name ?? row?.Name ?? rowRecord.id ?? rowRecord.ID ?? idx;
    const status = row?.status ?? row?.Status ?? row?.phase ?? row?.Phase ?? '';
    const base = `${name}-${status}`;
    const unique = `${base}-${idx}`;
    return ns ? `${ns}/${unique}` : String(unique);
  }, [namespace]);

  const selectionVisibleData = table.getRowModel().rows.map((row) => row.original);
  const selection = useTableSelection(tableData, getRowKey, selectionVisibleData);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!bulkEnabled || !selectAllRef.current) return;
    selectAllRef.current.indeterminate = selection.isIndeterminate;
  }, [bulkEnabled, selection.isIndeterminate, selection.isAllSelected]);

  useEffect(() => {
    if (!bulkEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selection.toggleAll();
        return;
      }
      if (e.key === 'Escape') {
        selection.clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bulkEnabled, selection]);

  const handleBulkAction = useCallback(async (action: BulkAction) => {
    if (!bulkEnabled || !action) return;
    const selectedRows = selection.getSelectedRows(selectionVisibleData);
    if (selectedRows.length === 0) return;

    if (action.confirm) {
      const ok = window.confirm(`${action.label} ${selectedRows.length} selected item(s)?`);
      if (!ok) return;
    }

    const options: { replicas?: number } = {};
    if (action.promptReplicas) {
      const rowRecord = selectedRows[0] as unknown as Record<string, unknown>;
      const current = (rowRecord?.replicas as number | undefined) ?? (rowRecord?.Replicas as number | undefined) ?? 0;
      const raw = window.prompt('Enter desired replica count:', String(current ?? 0));
      if (raw === null) return;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        showError('Replica count must be a non-negative number.');
        return;
      }
      options.replicas = Math.floor(parsed);
    }

    try {
      const summary = await executeBulkAction({
        platform: 'k8s',
        kind: 'pod',
        actionKey: action.key,
        rows: selectedRows as unknown as Record<string, unknown>[],
        options,
      });
      if (summary.failed === 0) {
        showSuccess(`${action.label} succeeded for ${summary.succeeded} item(s).`);
      } else {
        showError(`${action.label} completed with ${summary.failed} failure(s).`);
      }
      selection.clearSelection();
    } catch (err) {
      showError(`${action.label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [bulkEnabled, selection, selectionVisibleData]);

  const handleMenuClickRow = (index: number) => {
    setOpenMenuIndex(openMenuIndex === index ? null : index);
  };

  const handleMenuClose = () => {
    setOpenMenuIndex(null);
  };

  const closeBottomPanel = () => {
    setBottomOpen(false);
    setBottomPodName(null);
    setBottomNamespace(null);
    setBottomActiveTab('summary'); // Reset to default tab
    setForwardLocalPort(null); // Clear port forward state
    setForwardRemotePort(null); // Clear port forward state
  };

  const openDetails = async (podName: string, ns?: string) => {
    const resolvedNs = ns ?? namespace ?? '';
    setBottomPodName(podName);
    setBottomNamespace(resolvedNs || null);
    if (resolvedNs) {
      await ensureNamespace(resolvedNs);
    }
    setBottomActiveTab('summary');
    setBottomOpen(true);
  };

  const handleKubectlLogs = async (podName: string, ns?: string) => {
    const resolvedNs = ns ?? namespace ?? '';
    if (resolvedNs) {
      await ensureNamespace(resolvedNs);
    }
    setBottomPodName(podName);
    setBottomNamespace(resolvedNs || null);
    setBottomActiveTab('logs');
    setBottomOpen(true);
    setOpenMenuIndex(null);
  };

  const handleAnalyzeHolmes = async (podName: string, ns?: string) => {
    const targetNs = ns ?? namespace ?? '';
    if (!targetNs) {
      showNotification('Namespace unavailable for Holmes analysis.', 'error');
      return;
    }
    const key = `${targetNs}/${podName}`;
    const streamId = `pod-${Date.now()}`;
    setHolmesState({
      loading: true,
      response: null,
      error: null,
      key,
      streamId,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: new Date().toISOString(),
      contextSteps: [],
      toolEvents: [],
    });
    setBottomPodName(podName);
    setBottomNamespace(targetNs);
    setBottomActiveTab('holmes');
    setBottomOpen(true);

    try {
      await AnalyzePodStream(targetNs, podName, streamId);
      // The response comes via stream events, not from the return value
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHolmesState((prev) => ({ ...prev, loading: false, response: null, error: message, key }));
      showNotification(`❌ Holmes analysis failed: ${message}`, 'error');
    }
    handleMenuClose();
  };

  const handleCancelHolmes = async () => {
    const currentStreamId = holmesState.streamId;
    if (!currentStreamId) return;
    setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
    try {
      await CancelHolmesStream(currentStreamId);
    } catch (err) {
      console.error('Failed to cancel Holmes stream:', err);
    }
  };

  async function handleShell(podName: string, ns?: string) {
    try {
      const resolvedNs = ns ?? namespace ?? '';
      if (resolvedNs) {
        await ensureNamespace(resolvedNs);
      }
      setBottomPodName(podName);
      setBottomNamespace(resolvedNs || null);
      setBottomActiveTab('console');
      setBottomOpen(true);
    } catch (err) {
      showNotification(`❌ Failed to open shell for pod '${podName}': ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    handleMenuClose();
  }

  async function handlePortForward(podName: string, ns?: string) {
    const resolvedNs = ns ?? namespace ?? '';
    if (resolvedNs) {
      await ensureNamespace(resolvedNs);
    }
    setBottomPodName(podName);
    setBottomNamespace(resolvedNs || null);
    setBottomActiveTab('portforward');
    setBottomOpen(true);
    showNotification(`Configure port-forward for ${podName}…`, 'success');

    setPfDialogPod(podName);
    setShowPFDialog(true);
    handleMenuClose();
  }

  async function confirmPortForward({ sourcePort, targetPort }: { sourcePort: number; targetPort: number }) {
    const podName = pfDialogPod;
    const ns = bottomNamespace ?? namespace ?? '';
    setShowPFDialog(false);
    if (!podName) return;
    if (!ns) {
      showNotification('Namespace unavailable for port-forward.', 'error');
      return;
    }
    try {
      setBottomPodName(podName);
      setForwardLocalPort(targetPort);
      setForwardRemotePort(sourcePort);
      setBottomActiveTab('portforward');
      setBottomOpen(true);
      showNotification(`Starting port-forward to ${podName}: ${targetPort} -> ${sourcePort} ...`, 'success');
      await AppAPI.PortForwardPodWith(ns, podName, targetPort, sourcePort);
    } catch (err) {
      showNotification(`❌ Failed to start port-forward for pod '${podName}': ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  function cancelPortForwardDialog() { setShowPFDialog(false); setPfDialogPod(null); }

  async function handleStopPortForward(podName: string, ns?: string) {
    try {
      let portToStop = (forwardLocalPort && bottomPodName === podName) ? forwardLocalPort : null;
      if (!portToStop) {
        const input = window.prompt('Enter local port to stop forwarding:', '20000');
        if (input == null) return;
        const p = parseInt(String(input).trim(), 10);
        if (!Number.isFinite(p) || p <= 0 || p > 65535) {
          showNotification(`❌ Invalid port: ${input}`, 'error');
          return;
        }
        portToStop = p;
      }
      const resolvedNs = ns ?? namespace ?? '';
      if (!resolvedNs) {
        showNotification('Namespace unavailable for port-forward stop.', 'error');
        return;
      }
      await AppAPI.StopPortForward(resolvedNs, podName, portToStop);
      showNotification(`Stopped port-forward for ${podName}:${portToStop}.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to stop port-forward for '${podName}': ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    handleMenuClose();
  }

  // Delete pod handler
  async function handleDelete(podName: string, ns?: string) {
    try {
      const ok = window.confirm(`Delete pod '${podName}'?`);
      if (!ok) return;
      const resolvedNs = ns ?? namespace ?? '';
      if (!resolvedNs) {
        showNotification('Namespace unavailable for delete.', 'error');
        return;
      }
      await AppAPI.DeletePod(resolvedNs, podName);
      showNotification(`Pod '${podName}' deleted.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to delete pod '${podName}': ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    handleMenuClose();
  }

  function showNotification(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    setNotification({ message, type });
  }

  async function handleRestart(podName: string, ns?: string) {
    try {
      const resolvedNs = ns ?? namespace ?? '';
      if (!resolvedNs) {
        showNotification('Namespace unavailable for restart.', 'error');
        return;
      }
      await AppAPI.RestartPod(resolvedNs, podName);
      showNotification(`Pod '${podName}' restarted successfully.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to restart pod '${podName}': ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    handleMenuClose();
  }

  // Removed panelHeader - the PodSummaryTab already includes ResourceActions with Restart/Delete buttons

  const resolvedBottomPodName = bottomPodName ?? '';
  const resolvedBottomNamespace = bottomNamespace ?? namespace ?? '';

  const tabs = [
    { id: 'summary', label: 'Summary', content: <PodSummaryTab podName={resolvedBottomPodName} namespace={resolvedBottomNamespace || undefined} /> },
    {
      id: 'logs',
      label: 'Logs',
      content: (
        <div style={{ position: 'absolute', inset: 0 }}>
          <LogViewerTab podName={resolvedBottomPodName || undefined} namespace={resolvedBottomNamespace || undefined} embedded={true} />
        </div>
      )
    },
    {
      id: 'events',
      label: 'Events',
      content: <PodEventsTab namespace={resolvedBottomNamespace || undefined} podName={resolvedBottomPodName} />
    },
    {
      id: 'holmes',
      label: 'Holmes',
      content: (
        <HolmesBottomPanel
          kind="Pod"
          namespace={resolvedBottomNamespace || undefined}
          name={resolvedBottomPodName || undefined}
          onAnalyze={() => {
            if (resolvedBottomPodName) {
              handleAnalyzeHolmes(resolvedBottomPodName, resolvedBottomNamespace);
            }
          }}
          onCancel={holmesState.streamId ? () => { void handleCancelHolmes(); } : undefined}
          response={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.response : null}
          loading={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` && holmesState.loading}
          error={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.error : null}
          queryTimestamp={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.queryTimestamp : null}
          streamingText={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.streamingText : ''}
          reasoningText={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.reasoningText : ''}
          toolEvents={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.toolEvents : []}
          contextSteps={holmesState.key === `${resolvedBottomNamespace}/${resolvedBottomPodName}` ? holmesState.contextSteps : []}
        />
      )
    },
    {
      id: 'yaml',
      label: 'YAML',
      content: <PodYamlTab podName={resolvedBottomPodName} />
    },
    {
      id: 'console',
      label: 'Console',
      content: <ConsoleTab podExec={true} namespace={resolvedBottomNamespace || undefined} podName={resolvedBottomPodName || undefined} shell="auto" />
    },
    {
      id: 'portforward',
      label: 'Port Forward',
      content: <PortForwardOutput namespace={resolvedBottomNamespace} podName={resolvedBottomPodName} localPort={forwardLocalPort ?? 0} remotePort={forwardRemotePort ?? 0} />
    },
    {
      id: 'files',
      label: 'Files',
      content: <PodFilesTab podName={resolvedBottomPodName} />
    },
    {
      id: 'mounts',
      label: 'Mounts',
      content: <PodMountsTab podName={resolvedBottomPodName} />
    }
  ];

  // ensure backend namespace aligns when switching tabs that need it
  useEffect(() => {
    if (!bottomOpen || !bottomPodName) return;
    if (['logs','yaml','summary','mounts','files'].includes(bottomActiveTab)) {
      ensureNamespace(bottomNamespace || namespace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomActiveTab, bottomPodName, bottomNamespace]);

  const ROW_HEIGHT = 44; // px, adjust to match your row height
  const VISIBLE_COUNT = 20; // number of rows to show at once
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate which rows to show
  const totalRows = table.getRowModel().rows.length;
  const visibleRowStart = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleRows = table.getRowModel().rows.slice(visibleRowStart, visibleRowStart + VISIBLE_COUNT);
  const topPadHeight = visibleRowStart * ROW_HEIGHT;
  const bottomPadHeight = Math.max(0, (totalRows - (visibleRowStart + VISIBLE_COUNT)) * ROW_HEIGHT);

  // Scroll handler
  const handleScroll = (e: ReactUIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Dynamically adjust scrollable div height based on BottomPanel
  const scrollDivRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLTableElement | null>(null);
  const topHeaderRef = useRef<HTMLDivElement | null>(null);
  function updateScrollDivHeight() {
    const windowHeight = window.innerHeight;
    let headerHeight = 0;
    if (headerRef.current) {
      headerHeight = headerRef.current.offsetHeight;
    }
    let topHeaderHeight = 0;
    if (topHeaderRef.current) {
      topHeaderHeight = topHeaderRef.current.offsetHeight;
    }
    let bottomPanelHeight = 0;
    if (bottomOpen && bottomPanelRef.current) {
      bottomPanelHeight = bottomPanelRef.current.offsetHeight;
    }
    const margin = 100;
    const newHeight = windowHeight - headerHeight - topHeaderHeight - bottomPanelHeight - margin;
    if (scrollDivRef.current) {
      scrollDivRef.current.style.height = `${newHeight}px`;
    }
  }
  useEffect(() => {
    window.addEventListener('resize', updateScrollDivHeight);
    updateScrollDivHeight();
    let observer: ResizeObserver | undefined;
    if (bottomOpen && bottomPanelRef.current) {
      observer = new window.ResizeObserver(updateScrollDivHeight);
      observer.observe(bottomPanelRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateScrollDivHeight);
      if (observer) observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomOpen]);

  useEffect(() => {
    if (!notification.message) return;
    const timer = setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  function hasActivePF(podName: string, ns?: string) {
    const m = pfByKey[`${ns || ''}/${podName}`];
    if (!m) return false;
    return Object.values(m).some(arr => Array.isArray(arr) && arr.length > 0);
  }

  // Find the selected pod object for the bottom panel
  const _selectedRow = bottomOpen && bottomPodName
    ? tableData.find(pod => pod.name === bottomPodName && pod.namespace === (bottomNamespace || namespace))
    : null;

  return (
    <>
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        {notification.message && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            minWidth: 320,
            maxWidth: 600,
            padding: '12px 18px',
            background: notification.type === 'success' ? '#22863a' : '#d73a49',
            color: '#fff',
            textAlign: 'left',
            fontWeight: 500,
            fontSize: 16,
            borderRadius: 6,
            border: notification.type === 'success' ? '1px solid #2ea44f' : '1px solid #cb2431',
            boxShadow: '0 4px 16px rgba(27,31,35,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{fontSize: 20}}>{notification.type === 'success' ? '✔️' : '❌'}</span>
            <span style={{flex: 1}}>{notification.message.replace(/^✔️ |^❌ /, '')}</span>
            <button
              onClick={() => setNotification({ message: '', type: '' })}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 18,
                cursor: 'pointer',
                marginLeft: 8,
                opacity: 0.7,
              }}
              aria-label="Dismiss notification"
            >×</button>
          </div>
        )}
        <div ref={topHeaderRef} className="overview-header">
          <div className="overview-left">
            <button
              className="overview-create-btn menu-button"
              title="Create"
              aria-label="Create"
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            >+
            </button>
            {bulkEnabled && (
              <BulkActionBar
                selectedCount={selection.selectedCount}
                actions={bulkActions}
                onAction={handleBulkAction}
                onClear={selection.clearSelection}
              />
            )}
            {showMenu && (
              <div
                className="menu-content"
                style={{
                  position: 'absolute',
                  top: 40,
                  left: 0,
                  background: 'var(--gh-table-header-bg, #2d323b)',
                  border: '1px solid #353a42',
                  borderRadius: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  zIndex: 1200, // raised to sit above notifications & bottom panel
                  minWidth: 180,
                  padding: '4px 0',
                  textAlign: 'left', // <-- ensure left alignment
                }}
                onClick={handleMenuClick}
              >
                {createOptions.map(opt => (
                  <div
                    key={opt.key}
                    style={{ padding:'8px 18px', cursor:'pointer', color:'#fff', fontSize:15, whiteSpace:'nowrap', textAlign: 'left' }}
                    onClick={() => {
              setShowMenu(false);
              setTimeout(() => {
                if (onCreateResource) {
                  onCreateResource(opt.key);
                  return;
                }
                showResourceOverlay(opt.key);
              }, 0);
            }}
                  >{opt.label}</div>
                ))}
              </div>
            )}
          </div>
          <h2 className="overview-title">Pods</h2>
          <div className="overview-actions">
            <input
              type="search"
              value={filterValue}
              onChange={e => setFilterValue(e.target.value)}
              placeholder="Filter..."
            />
          </div>
        </div>
        {loading && <div>Loading...</div>}
        {/* Fixed header table */}
        {/* Column widths: Name(25%), Namespace(12% if multiNs), Status(15%), Ports(15%), Restarts(8%), Uptime(10-15%), Actions(15-20%) */}
        <table id="pod-table-header" className="gh-table" ref={headerRef} style={{ width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            {bulkEnabled && <col className="bulk-checkbox-col" />}
            <col style={{ width: '25%' }} />
            {multiNs && <col style={{ width: '12%' }} />}
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: multiNs ? '10%' : '15%' }} />
            <col style={{ width: multiNs ? '15%' : '20%' }} />
          </colgroup>
          <thead>
          {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {bulkEnabled && (
                  <th className="bulk-checkbox-col" aria-label="Select all">
                    <input
                      ref={selectAllRef}
                      className="bulk-select-all"
                      type="checkbox"
                      checked={selection.isAllSelected}
                      onChange={() => selection.toggleAll()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                )}
                {headerGroup.headers.map(header => (
                    <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          background: 'var(--gh-bg)',
                          color: 'var(--gh-table-header-text, #fff)',
                          borderBottom: '2px solid #353a42',
                          fontWeight: 600,
                          // fontSize removed to use global CSS for uniform height
                          textAlign: header.column.id === 'uptime' ? 'right' : header.column.id === 'restarts' ? 'center' : 'left',
                          userSelect: 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                        }}
                  >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() ? (header.column.getIsSorted() === 'asc' ? ' 🔼' : ' 🔽') : ''}
                  </th>
                ))}
                <th
                    style={{
                      background: 'var(--gh-bg)',
                      color: 'var(--gh-table-header-text, #fff)',
                      borderBottom: '2px solid #353a42',
                      fontWeight: 600,
                      // fontSize removed to use global CSS for uniform height
                      textAlign: 'right',
                      userSelect: 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                    }}
                    aria-label="Actions"
                    title="Actions"
                >
                  Actions
                </th>
              </tr>
          ))}
          </thead>
        </table>
        <div ref={scrollDivRef} style={{ overflowY: 'auto', width: '100%', marginBottom: '50px' }} onScroll={handleScroll}>
          <table className="gh-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              {bulkEnabled && <col className="bulk-checkbox-col" />}
              <col style={{ width: '25%' }} />
              {multiNs && <col style={{ width: '12%' }} />}
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: multiNs ? '10%' : '15%' }} />
              <col style={{ width: multiNs ? '15%' : '20%' }} />
            </colgroup>
            <tbody>
            {topPadHeight > 0 && (
                <tr style={{height: topPadHeight}}>
                  <td colSpan={baseColumns.length + 1 + (bulkEnabled ? 1 : 0)} style={{padding: 0, border: 'none', background: 'transparent'}}/>
                </tr>
            )}
            {visibleRows.map((row, i) => {
                const rowKey = getRowKey(row.original, visibleRowStart + i);
                return (
                <tr
                    key={rowKey}
                    onClick={(e) => {
                      if (bulkEnabled && e.shiftKey) {
                        e.preventDefault();
                        selection.toggleRow(getRowKey(row.original, visibleRowStart + i), visibleRowStart + i, true);
                        return;
                      }
                      openDetails(row.original.name, row.original.namespace);
                    }}
                    className={bulkEnabled && selection.isSelected(getRowKey(row.original, row.index)) ? 'bulk-selected' : undefined}
                    style={{
                      borderBottom: '1px solid #353a42',
                      transition: 'background 0.2s',
                      height: ROW_HEIGHT
                    }}
                >
                  {bulkEnabled && (
                    <td className="bulk-checkbox-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="bulk-row-checkbox"
                        type="checkbox"
                        checked={selection.isSelected(getRowKey(row.original, row.index))}
                        onClick={(e) => {
                          e.stopPropagation();
                          selection.toggleRow(getRowKey(row.original, visibleRowStart + i), visibleRowStart + i, e.shiftKey);
                        }}
                        onChange={() => {}}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map(cell => (
                      <td
                          key={cell.id}
                          style={{
                            // padding handled by CSS .gh-table tbody td
                            fontSize: 14,
                            color: 'var(--gh-table-text, #e0e0e0)',
                            borderBottom: '1px solid #353a42',
                            textAlign: cell.column.id === 'uptime' ? 'right' : cell.column.id === 'restarts' ? 'center' : 'left',
                            background: 'inherit',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                  ))}
                  <td style={{position: 'relative', textAlign: 'right'}}>
                    <button
                      className="row-actions-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClickRow(visibleRowStart + i);
                      }}
                    >···
                    </button>
                    {openMenuIndex === (visibleRowStart + i) && (
                        <div
                            className="menu-content"
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              background: 'var(--gh-table-header-bg, #2d323b)',
                              border: '1px solid #353a42',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                              zIndex: 1200, // raised above other floating UI
                              minWidth: 180,
                              textAlign: 'left',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={() => handleKubectlLogs(row.original.name, row.original.namespace)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>📜</span>
                            <span>Logs</span>
                          </div>
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={() => handleAnalyzeHolmes(row.original.name, row.original.namespace)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🧠</span>
                            <span>Ask Holmes</span>
                          </div>
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={() => handleRestart(row.original.name, row.original.namespace)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🔄</span>
                            <span>Restart</span>
                          </div>
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={() => handleShell(row.original.name, row.original.namespace)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>💻</span>
                            <span>Shell</span>
                          </div>
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={() => handlePortForward(row.original.name, row.original.namespace)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🔌</span>
                            <span>Port Forward</span>
                          </div>
                          {hasActivePF(row.original.name, row.original.namespace) && (
                              <div
                                  className="context-menu-item"
                                  style={{
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    color: '#fff',
                                    fontSize: 15,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                  }}
                                  onClick={() => handleStopPortForward(row.original.name, row.original.namespace)}
                              >
                                <span aria-hidden="true"
                                      style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🛑</span>
                                <span>Stop Port Forward</span>
                              </div>
                          )}
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={() => handleDelete(row.original.name, row.original.namespace)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🗑️</span>
                            <span>Delete</span>
                          </div>
                        </div>
                    )}
                  </td>
                </tr>
                );
              })}
            {bottomPadHeight > 0 && (
                <tr style={{height: bottomPadHeight}}>
                  <td colSpan={baseColumns.length + 1 + (bulkEnabled ? 1 : 0)} style={{padding: 0, border: 'none', background: 'transparent'}}/>
                </tr>
            )}
            </tbody>
          </table>
        </div>
        {data.length >= 20 && (
          <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} style={{padding:'6px 14px', borderRadius:0, border:'1px solid #353a42', background:'var(--gh-table-header-bg, #2d323b)', color:'var(--gh-table-header-text, #fff)', cursor: table.getCanPreviousPage() ? 'pointer' : 'not-allowed'}}>Previous</button>
            <span style={{margin:'0 8px', fontSize:14, color:'var(--gh-table-text, #e0e0e0)'}}>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} style={{padding:'6px 14px', borderRadius:0, border:'1px solid #353a42', background:'var(--gh-table-header-bg, #2d323b)', color:'var(--gh-table-header-text, #fff)', cursor: table.getCanNextPage() ? 'pointer' : 'not-allowed'}}>Next</button>
          </div>
        )}

        {/* Bottom panel with tabs - only render if open, and use ref */}
        {bottomOpen && (
          <BottomPanel
            ref={bottomPanelRef}
            open={bottomOpen}
            onClose={closeBottomPanel}
            tabs={tabs}
            activeTab={bottomActiveTab}
            onTabChange={(id) => setBottomActiveTab(id)}
            headerRight={null}
          />
        )}
        <PortForwardDialog
          open={showPFDialog}
          _namespace={namespace}
          podName={pfDialogPod ?? undefined}
          onCancel={cancelPortForwardDialog}
          onConfirm={confirmPortForward}
        />
      </div>
    </>
  );
}

