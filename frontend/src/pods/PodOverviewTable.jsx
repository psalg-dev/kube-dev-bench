import React, {useEffect, useMemo, useState} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as AppAPI from '../../wailsjs/go/main/App';
import {EventsOff, EventsOn} from '../../wailsjs/runtime';
import LogViewer from '../LogViewer';
import PodSummaryTab from './PodSummaryTab';
import PodEventsTab from './PodEventsTab';
import PodYamlTab from './PodYamlTab';
import Console from '../Console';
import PortForwardOutput from './PortForwardOutput';
import BottomPanel from '../BottomPanel';
import PortForwardDialog from './PortForwardDialog';
import PodMountsTab from './PodMountsTab';

export default function PodOverviewTable({ namespace, data = [], loading = false, onCreateResource }) {
  const [now, setNow] = useState(Date.now());
  // Default sorting: uptime ascending (youngest at top)
  const [sorting, setSorting] = useState([{ id: 'uptime', desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [columnFilters, setColumnFilters] = useState([]);
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomPodName, setBottomPodName] = useState(null);
  const [bottomActiveTab, setBottomActiveTab] = useState('summary');
  const [showMenu, setShowMenu] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [showPFDialog, setShowPFDialog] = useState(false);
  const [pfDialogPod, setPfDialogPod] = useState(null);
  const [forwardLocalPort, setForwardLocalPort] = useState(null);
  const [forwardRemotePort, setForwardRemotePort] = useState(null);
  const [internalData, setInternalData] = useState([]);
  // Track active port-forwards: { [podName]: { [remotePort]: number[]locals } }
  const [pfByPod, setPfByPod] = useState({});

  // Fallback: subscribe to pods:update if parent doesn't pass data
  useEffect(() => {
    const handler = (pods) => {
      setInternalData(Array.isArray(pods) ? pods : []);
    };
    EventsOn('pods:update', handler);
    return () => {
      try { EventsOff('pods:update'); } catch (_) {}
    };
  }, []);

  // Subscribe to consolidated portforward updates and seed initial state
  useEffect(() => {
    function buildMap(list) {
      const map = {};
      if (Array.isArray(list)) {
        for (const item of list) {
          if (!item) continue;
          const ns = item.namespace || item.Namespace; // tolerate different casings
          if (namespace && ns && ns !== namespace) continue;
          const pod = item.pod || item.Pod;
          const local = item.local ?? item.Local;
          const remote = item.remote ?? item.Remote;
          if (!pod || !Number.isFinite(local) || !Number.isFinite(remote)) continue;
          if (!map[pod]) map[pod] = {};
          if (!map[pod][remote]) map[pod][remote] = [];
          if (!map[pod][remote].includes(local)) map[pod][remote].push(local);
        }
      }
      return map;
    }

    const onUpdate = (list) => {
      setPfByPod(buildMap(list));
    };

    EventsOn('portforwards:update', onUpdate);

    // Try to fetch initial forwards if binding exists
    const maybeFetch = async () => {
      try {
        const fn = window?.go?.main?.App?.ListPortForwards;
        if (typeof fn === 'function') {
          const list = await fn();
          setPfByPod(buildMap(list));
        }
      } catch (_) {
        // ignore
      }
    };
    maybeFetch();

    return () => {
      try { EventsOff('portforwards:update'); } catch (_) {}
    };
  }, [namespace]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        setOpenMenuIndex(null);
        return;
      }
      if (!target.closest('.menu-button') && !target.closest('.menu-content')) {
        setOpenMenuIndex(null);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuIndex]);

  useEffect(() => {
    setColumnFilters([{ id: 'name', value: filterValue }]);
  }, [filterValue]);

  function handleMenuClick(e) {
    e.stopPropagation();
  }

  function formatUptime(startTime) {
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

  function renderPortsCell(pod) {
    const ports = pod?.ports || [];
    if (!ports || ports.length === 0) return '-';
    const fForPod = pfByPod[pod.name] || {};
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

  function renderStatusCell(pod) {
    const status = pod.status || pod.phase || '-';
    let color = '#aaa';
    let label = status;
    if (typeof status === 'string') {
      const s = status.toLowerCase();
      if (s === 'running') {
        color = '#2ea44f'; // green
        label = 'Running';
      } else if (s === 'pending' || s === 'creating' || s === 'containercreating') {
        color = '#e6b800'; // yellow
        label = 'Creating';
      } else if (s === 'failed' || s === 'error' || s === 'crashloopbackoff') {
        color = '#d73a49'; // red
        label = 'Failed';
      }
    }
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block', border: '1px solid #888' }} />
        <span>{label}</span>
      </span>
    );
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Pod Name',
      filterFn: 'includesString',
      cell: info => info.getValue(),
    },
    {
      id: 'status',
      header: 'Status',
      cell: info => renderStatusCell(info.row.original),
      enableSorting: false,
      filterFn: undefined,
    },
    {
      id: 'ports',
      header: 'Ports',
      cell: info => renderPortsCell(info.row.original),
      enableSorting: false,
      filterFn: undefined,
    },
    {
      accessorKey: 'restarts',
      header: 'Restarts',
      cell: info => info.getValue() || 0,
      sortingFn: (rowA, rowB) => {
        const restartsA = rowA.original.restarts || 0;
        const restartsB = rowB.original.restarts || 0;
        return restartsA - restartsB;
      },
      filterFn: undefined,
    },
    {
      accessorKey: 'uptime',
      header: 'Uptime',
      cell: info => formatUptime(info.row.original.startTime),
      sortingFn: (rowA, rowB) => {
        const startTimeA = new Date(rowA.original.startTime || 0).getTime();
        const startTimeB = new Date(rowB.original.startTime || 0).getTime();
        return startTimeB - startTimeA;
      },
      filterFn: undefined,
    },
  ], [now, pfByPod]);

  const tableData = (Array.isArray(data) && data.length > 0) ? data : internalData;

  const table = useReactTable({
    data: tableData,
    columns,
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

  const handleMenuClickRow = (index) => {
    setOpenMenuIndex(openMenuIndex === index ? null : index);
  };

  const handleMenuClose = () => {
    setOpenMenuIndex(null);
  };

  const openLogsPanel = async (podName) => {
    setBottomPodName(podName);
    setBottomActiveTab('summary');
    setBottomOpen(true);
  };

  const handleKubectlLogs = (podName) => {
    setBottomPodName(podName);
    setBottomActiveTab('logs');
    setBottomOpen(true);
    setOpenMenuIndex(null);
  };

  useEffect(() => {
    if (!notification.message) return;
    const timer = setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  function showNotification(message, type = 'success') {
    setNotification({ message, type });
  }

  async function handleRestart(podName) {
    try {
      await AppAPI.RestartPod(namespace, podName);
      showNotification(`Pod '${podName}' restarted successfully.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to restart pod '${podName}': ${err.message || err}`, 'error');
    }
    handleMenuClose();
  }

  async function handleShell(podName) {
    try {
      setBottomPodName(podName);
      setBottomActiveTab('console');
      setBottomOpen(true);
    } catch (err) {
      showNotification(`❌ Failed to open shell for pod '${podName}': ${err.message || err}`, 'error');
    }
    handleMenuClose();
  }

  async function handlePortForward(podName) {
    // Open the Port Forward tab immediately so the user sees context
    setBottomPodName(podName);
    setBottomActiveTab('portforward');
    setBottomOpen(true);
    showNotification(`Configure port-forward for ${podName}…`, 'success');

    setPfDialogPod(podName);
    setShowPFDialog(true);
    handleMenuClose();
  }

  async function confirmPortForward({ sourcePort, targetPort }) {
    const podName = pfDialogPod;
    setShowPFDialog(false);
    if (!podName) return;
    try {
      setBottomPodName(podName);
      setForwardLocalPort(targetPort);
      setForwardRemotePort(sourcePort);
      setBottomActiveTab('portforward');
      setBottomOpen(true);
      showNotification(`Starting port-forward to ${podName}: ${targetPort} -> ${sourcePort} ...`, 'success');
      const start = window?.go?.main?.App?.PortForwardPodWith;
      if (typeof start === 'function') {
        await start(namespace, podName, targetPort, sourcePort);
      } else {
        await AppAPI.PortForwardPod(namespace, podName, sourcePort);
      }
    } catch (err) {
      showNotification(`❌ Failed to start port-forward for pod '${podName}': ${err?.message || err}`, 'error');
    }
  }

  function cancelPortForwardDialog() {
    setShowPFDialog(false);
    setPfDialogPod(null);
  }

  async function handleStopPortForward(podName) {
    try {
      let portToStop = (forwardLocalPort && bottomPodName === podName) ? forwardLocalPort : null;
      if (!portToStop) {
        const input = window.prompt(`Enter local port to stop forwarding:`, '20000');
        if (input == null) return;
        const p = parseInt(String(input).trim(), 10);
        if (!Number.isFinite(p) || p <= 0 || p > 65535) {
          showNotification(`❌ Invalid port: ${input}`, 'error');
          return;
        }
        portToStop = p;
      }
      const stop = window?.go?.main?.App?.StopPortForward;
      if (typeof stop === 'function') {
        await stop(namespace, podName, portToStop);
        showNotification(`Stopped port-forward for ${podName}:${portToStop}.`, 'success');
      } else {
        showNotification(`❌ StopPortForward not available. Please rebuild bindings.`, 'error');
      }
    } catch (err) {
      showNotification(`❌ Failed to stop port-forward for '${podName}': ${err?.message || err}`, 'error');
    }
    handleMenuClose();
  }

  // Delete pod handler
  async function handleDelete(podName) {
    try {
      const ok = window.confirm(`Delete pod '${podName}'?`);
      if (!ok) return;
      await AppAPI.DeletePod(namespace, podName);
      showNotification(`Pod '${podName}' deleted.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to delete pod '${podName}': ${err?.message || err}`, 'error');
    }
    handleMenuClose();
  }

  const tabs = [
    { id: 'summary', label: 'Summary', content: <PodSummaryTab podName={bottomPodName} /> },
    {
      id: 'logs',
      label: 'Logs',
      content: (
        <div style={{ position: 'absolute', inset: 0 }}>
          <LogViewer podName={bottomPodName} embedded={true} />
        </div>
      )
    },
    {
      id: 'events',
      label: 'Events',
      content: <PodEventsTab namespace={namespace} podName={bottomPodName} />
    },
    {
      id: 'yaml',
      label: 'YAML',
      content: <PodYamlTab podName={bottomPodName} />
    },
    {
      id: 'console',
      label: 'Console',
      content: <Console podExec={true} namespace={namespace} podName={bottomPodName} shell="auto" />
    },
    {
      id: 'portforward',
      label: 'Port Forward',
      content: <PortForwardOutput namespace={namespace} podName={bottomPodName} localPort={forwardLocalPort} remotePort={forwardRemotePort} />
    },
    {
      id: 'mounts',
      label: 'Mounts',
      content: <PodMountsTab podName={bottomPodName} />
    }
  ];

  function hasActivePF(podName) {
    const m = pfByPod[podName];
    if (!m) return false;
    return Object.values(m).some(arr => Array.isArray(arr) && arr.length > 0);
  }

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
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  // Dynamically adjust scrollable div height based on BottomPanel
  const scrollDivRef = React.useRef(null);
  const bottomPanelRef = React.useRef(null);
  const headerRef = React.useRef(null);
  function updateScrollDivHeight() {
    const windowHeight = window.innerHeight;
    let headerHeight = 0;
    if (headerRef.current) {
      headerHeight = headerRef.current.offsetHeight;
    }
    let bottomPanelHeight = 0;
    if (bottomOpen && bottomPanelRef.current) {
      bottomPanelHeight = bottomPanelRef.current.offsetHeight;
    }
    const margin = 100;
    const newHeight = windowHeight - headerHeight - bottomPanelHeight - margin;
    if (scrollDivRef.current) {
      scrollDivRef.current.style.height = `${newHeight}px`;
    }
  }
  useEffect(() => {
    window.addEventListener('resize', updateScrollDivHeight);
    updateScrollDivHeight();
    let observer;
    if (bottomOpen && bottomPanelRef.current) {
      observer = new window.ResizeObserver(updateScrollDivHeight);
      observer.observe(bottomPanelRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateScrollDivHeight);
      if (observer) observer.disconnect();
    };
  }, [bottomOpen]);

  useEffect(() => {
    if (!bottomOpen) return;
    function handleClickOutsidePanel(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (bottomPanelRef.current && !bottomPanelRef.current.contains(target)) {
        setBottomOpen(false);
        setBottomPodName(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutsidePanel);
    return () => document.removeEventListener('mousedown', handleClickOutsidePanel);
  }, [bottomOpen]);

  return (
    <>
      <div style={{
        position: 'relative',
        height: '100vh',
        width: '100%',
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
        <div style={{marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
          <div style={{position:'relative', display:'flex', alignItems:'center'}}>
            <button
              className="menu-button create-button"
              title="Ressource erstellen"
              style={{fontSize: 22, width: 36, height: 36, borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            >+
            </button>
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
                  zIndex: 10,
                  minWidth: 140,
                  padding: '4px 0',
                }}
                onClick={handleMenuClick}
              >
                <div
                  style={{padding:'8px 18px', cursor:'pointer', color:'#fff', fontSize:15, whiteSpace:'nowrap'}}
                  onClick={() => { setShowMenu(false); setTimeout(() => { onCreateResource && onCreateResource('deployment'); }, 0); }}
                >Deployment</div>
                <div
                  style={{padding:'8px 18px', cursor:'pointer', color:'#fff', fontSize:15, whiteSpace:'nowrap'}}
                  onClick={() => { setShowMenu(false); setTimeout(() => { onCreateResource && onCreateResource('job'); }, 0); }}
                >Job</div>
              </div>
            )}
          </div>
          <input
            type="text"
            value={filterValue}
            onChange={e => setFilterValue(e.target.value)}
            placeholder="Filter pods..."
            style={{
              padding: '7px 12px',
              borderRadius: 0,
              border: '1px solid #353a42',
              background: 'var(--gh-table-header-bg, #2d323b)',
              color: 'var(--gh-table-header-text, #fff)',
              fontSize: 14,
              outline: 'none',
              width: 220,
            }}
          />
        </div>
        {loading && <div>Loading...</div>}
        {/* Fixed header table */}
        <table id="pod-table-header" ref={headerRef} style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
          {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                    <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          background: 'var(--gh-table-header-bg, #2d323b)',
                      color: 'var(--gh-table-header-text, #fff)',
                          borderBottom: '2px solid #353a42',
                          padding: '10px 16px',
                          fontWeight: 600,
                          fontSize: 15,
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
                      background: 'var(--gh-table-header-bg, #2d323b)',
                      color: 'var(--gh-table-header-text, #fff)',
                      borderBottom: '2px solid #353a42',
                      padding: '10px 16px',
                      fontWeight: 600,
                      fontSize: 18,
                      textAlign: 'right',
                      userSelect: 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                    }}
                    aria-label="Actions"
                    title="Actions"
                >
                  <span style={{opacity: 0.7, fontSize: 20, verticalAlign: 'middle'}}>⋮</span>
                </th>
              </tr>
          ))}
          </thead>
        </table>
        <div ref={scrollDivRef} style={{ overflowY: 'auto', width: '100%', marginBottom: '50px' }}>
          <table style={{ width: '100%', tableLayout: 'fixed' }}>
            <tbody>
            {topPadHeight > 0 && (
                <tr style={{height: topPadHeight}}>
                  <td colSpan={columns.length + 1} style={{padding: 0, border: 'none', background: 'transparent'}}/>
                </tr>
            )}
            {visibleRows.map((row, i) => (
                <tr
                    key={row.id}
                    className="pod-row"
                    onClick={() => openLogsPanel(row.original.name)}
                    style={{
                      background: (visibleRowStart + i) % 2 === 0 ? 'var(--gh-table-row-even, #23272e)' : 'var(--gh-table-row-odd, #262b33)',
                      borderBottom: '1px solid #353a42',
                      transition: 'background 0.2s',
                      height: ROW_HEIGHT
                    }}
                >
                  {row.getVisibleCells().map(cell => (
                      <td
                          key={cell.id}
                          style={{
                            padding: '10px 16px',
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
                    <button onClick={(e) => {
                      e.stopPropagation();
                      handleMenuClickRow(visibleRowStart + i);
                    }} style={{
                      padding: '2px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--gh-table-header-text, #fff)',
                      cursor: 'pointer'
                    }}>...
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
                              zIndex: 10,
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
                              onClick={() => handleKubectlLogs(row.original.name)}
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
                              onClick={() => handleRestart(row.original.name)}
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
                              onClick={() => handleShell(row.original.name)}
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
                              onClick={() => handlePortForward(row.original.name)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🔌</span>
                            <span>Port Forward</span>
                          </div>
                          {hasActivePF(row.original.name) && (
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
                                  onClick={() => handleStopPortForward(row.original.name)}
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
                              onClick={() => handleDelete(row.original.name)}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>🗑️</span>
                            <span>Delete</span>
                          </div>
                          <div
                              className="context-menu-item"
                              style={{
                                padding: '4px 16px',
                                cursor: 'pointer',
                                color: '#888',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                              onClick={handleMenuClose}
                          >
                            <span aria-hidden="true"
                                  style={{width: 18, display: 'inline-block', textAlign: 'center'}}>✖️</span>
                            <span>Close</span>
                          </div>
                        </div>
                    )}
                  </td>
                </tr>
              ))}
            {bottomPadHeight > 0 && (
                <tr style={{height: bottomPadHeight}}>
                  <td colSpan={columns.length + 1} style={{padding: 0, border: 'none', background: 'transparent'}}/>
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
            onClose={() => { setBottomOpen(false); setBottomPodName(null); }}
            tabs={tabs}
            activeTab={bottomActiveTab}
            onTabChange={(id) => setBottomActiveTab(id)}
          />
        )}
        <PortForwardDialog
          open={showPFDialog}
          namespace={namespace}
          podName={pfDialogPod}
          onCancel={cancelPortForwardDialog}
          onConfirm={confirmPortForward}
        />
      </div>
    </>
  );
}
