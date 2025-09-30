import React, { useEffect, useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';
import * as AppAPI from '../../wailsjs/go/main/App';
import LogViewer from '../LogViewer';
import BottomPanel from '../BottomPanel';
import PodEventsTab from './PodEventsTab';
import PodYamlTab from './PodYamlTab';
import PodSummaryTab from './PodSummaryTab';
import Console from '../Console';

export default function PodOverviewTable({ namespace, onCreateResource }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState([{ id: 'uptime', desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [columnFilters, setColumnFilters] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [filterValue, setFilterValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  // Bottom panel state
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomActiveTab, setBottomActiveTab] = useState('logs');
  const [bottomPodName, setBottomPodName] = useState(null);
  const [consoleCommand, setConsoleCommand] = useState('');
  const [notification, setNotification] = useState({ message: '', type: '' });

  // Subscribe to Wails event for pod updates
  useEffect(() => {
    setLoading(true);
    const handler = (pods) => {
      setData(Array.isArray(pods) ? pods : []);
      setLoading(false);
    };
    EventsOn('pods:update', handler);
    return () => {
      EventsOff('pods:update');
    };
  }, []);

  // Reset data when namespace changes
  useEffect(() => {
    setData([]);
    setLoading(true);
  }, [namespace]);

  // Local ticking state for uptime
  useEffect(() => {
    let running = true;
    function tick() {
      if (!running) return;
      setNow(Date.now());
      setTimeout(tick, 1000);
    }
    tick();
    return () => { running = false; };
  }, []);

  // Keep the filter in sync with the table's columnFilters
  useEffect(() => {
    setColumnFilters([{ id: 'name', value: filterValue }]);
  }, [filterValue]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick() {
      setShowMenu(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showMenu]);

  // Close pod row context menu on outside click
  useEffect(() => {
    if (openMenuIndex === null) return;
    function handleClick() {
      setOpenMenuIndex(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openMenuIndex]);

  // Prevent menu from closing when clicking inside
  function handleMenuClick(e) {
    e.stopPropagation();
  }

  // Helper to format uptime from startTime
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

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Pod Name',
      filterFn: 'includesString',
      cell: info => info.getValue(),
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
        return startTimeB - startTimeA; // Newer pods (later start time) first when desc=true
      },
      filterFn: undefined,
    },
  ], [now]);

  const table = useReactTable({
    data,
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
    openLogsPanel(podName);
    setOpenMenuIndex(null);
  };

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (!notification.message) return;
    const timer = setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Helper to show notification
  function showNotification(message, type = 'success') {
    setNotification({ message, type });
  }

  // Handler for Restart
  async function handleRestart(podName) {
    try {
      await AppAPI.RestartPod(namespace, podName);
      showNotification(`Pod '${podName}' restarted successfully.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to restart pod '${podName}': ${err.message || err}`, 'error');
    }
    handleMenuClose();
  }

  // Handler for Shell
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

  // Handler for Port Forward (default port 8080 for demo)
  async function handlePortForward(podName) {
    const port = 8080; // You may want to prompt for port
    try {
      const cmd = await AppAPI.PortForwardPod(namespace, podName, port);
      showNotification(`✔️ Port-forward command: ${cmd}`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to get port-forward command for pod '${podName}': ${err.message || err}`, 'error');
    }
    handleMenuClose();
  }

  // Handler for Delete
  async function handleDelete(podName) {
    if (!window.confirm(`Are you sure you want to delete pod '${podName}'?`)) {
      handleMenuClose();
      return;
    }
    try {
      await AppAPI.DeletePod(namespace, podName);
      showNotification(`✔️ Pod '${podName}' deleted successfully.`, 'success');
    } catch (err) {
      showNotification(`❌ Failed to delete pod '${podName}': ${err.message || err}`, 'error');
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
    }
  ];

  return (
    <div style={{ position: 'relative', minHeight: 400 }}>
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
          background: notification.type === 'success' ? '#22863a' : '#d73a49', // less bright green
          color: '#fff',
          textAlign: 'left',
          fontWeight: 500,
          fontSize: 16,
          borderRadius: 6,
          border: notification.type === 'success' ? '1px solid #2ea44f' : '1px solid #cb2431', // green border
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
            className="create-button"
            title="Ressource erstellen"
            style={{fontSize: 22, width: 36, height: 36, borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}
            onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
          >+
          </button>
          {showMenu && (
            <div
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
      <table className="pods-table" style={{
        borderCollapse: 'collapse',
        width: '100%',
        background: 'var(--gh-table-bg, #23272e)', // Use dark theme variable or fallback
        borderRadius: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
      }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} style={{ background: 'var(--gh-table-header-bg, #2d323b)' }}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 16px',
                    borderBottom: '2px solid #353a42',
                    textAlign: header.column.id === 'uptime' ? 'right' : header.column.id === 'restarts' ? 'center' : 'left',
                    fontWeight: 600,
                    fontSize: 15,
                    color: 'var(--gh-table-header-text, #fff)',
                    background: 'inherit',
                    userSelect: 'none',
                  }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() ? (header.column.getIsSorted() === 'asc' ? ' 🔼' : ' 🔽') : ''}
                </th>
              ))}
              <th
                style={{
                  width: '40px',
                  borderBottom: '2px solid #353a42',
                  background: 'inherit',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: 18,
                  color: 'var(--gh-table-header-text, #fff)',
                  userSelect: 'none',
                }}
                aria-label="Actions"
                title="Actions"
              >
                <span style={{ opacity: 0.7, fontSize: 20, verticalAlign: 'middle' }}>⋮</span>
              </th>
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={() => openLogsPanel(row.original.name)}
              style={{
                background: i % 2 === 0 ? 'var(--gh-table-row-even, #23272e)' : 'var(--gh-table-row-odd, #262b33)',
                borderBottom: '1px solid #353a42',
                transition: 'background 0.2s',
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
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              <td style={{ position: 'relative', textAlign: 'right' }}>
                <button onClick={(e) => { e.stopPropagation(); handleMenuClickRow(i); }} style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: 'var(--gh-table-header-text, #fff)', cursor: 'pointer' }}>...</button>
                {openMenuIndex === i && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: 'var(--gh-table-header-bg, #2d323b)',
                      border: '1px solid #353a42',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                      zIndex: 10,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      style={{ padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 15 }}
                      onClick={() => handleKubectlLogs(row.original.name)}
                    >
                      kubectl logs
                    </div>
                    <div
                      style={{ padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 15 }}
                      onClick={() => handleRestart(row.original.name)}
                    >
                      Restart
                    </div>
                    <div
                      style={{ padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 15 }}
                      onClick={() => handleShell(row.original.name)}
                    >
                      Shell
                    </div>
                    <div
                      style={{ padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 15 }}
                      onClick={() => handlePortForward(row.original.name)}
                    >
                      Port Forward
                    </div>
                    <div
                      style={{ padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 15 }}
                      onClick={() => handleDelete(row.original.name)}
                    >
                      Delete
                    </div>
                    <div
                      style={{ padding: '4px 16px', cursor: 'pointer', color: '#888', fontSize: '12px' }}
                      onClick={handleMenuClose}
                    >
                      Close
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length >= 20 && (
        <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} style={{padding:'6px 14px', borderRadius:0, border:'1px solid #353a42', background:'var(--gh-table-header-bg, #2d323b)', color:'var(--gh-table-header-text, #fff)', cursor: table.getCanPreviousPage() ? 'pointer' : 'not-allowed'}}>Previous</button>
          <span style={{margin:'0 8px', fontSize:14, color:'var(--gh-table-text, #e0e0e0)'}}>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} style={{padding:'6px 14px', borderRadius:0, border:'1px solid #353a42', background:'var(--gh-table-header-bg, #2d323b)', color:'var(--gh-table-header-text, #fff)', cursor: table.getCanNextPage() ? 'pointer' : 'not-allowed'}}>Next</button>
        </div>
      )}

      {/* Bottom panel with tabs */}
      <BottomPanel
        open={bottomOpen}
        onClose={() => { setBottomOpen(false); setBottomPodName(null); }}
        tabs={tabs}
        activeTab={bottomActiveTab}
        onTabChange={(id) => setBottomActiveTab(id)}
      />
    </div>
  );
}
