import React, { useEffect, useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { GetRunningPods } from '../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

export default function PodOverviewTable({ namespace, onCreateResource }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState([{ id: 'uptime', desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [columnFilters, setColumnFilters] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [filterValue, setFilterValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);

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
    function handleClick(e) {
      setShowMenu(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showMenu]);

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

  return (
    <div>
      <div style={{marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <div style={{position:'relative', display:'flex', alignItems:'center'}}>
          <button
            className="create-button"
            title="Ressource erstellen"
            style={{fontSize: 22, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
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
                borderRadius: 6,
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
            borderRadius: 4,
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
      <table style={{
        borderCollapse: 'collapse',
        width: '100%',
        background: 'var(--gh-table-bg, #23272e)', // Use dark theme variable or fallback
        borderRadius: 8,
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
                    textAlign: header.column.id === 'uptime' ? 'right' : 'left',
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
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
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
                    textAlign: cell.column.id === 'uptime' ? 'right' : 'left',
                    background: 'inherit',
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length >= 20 && (
        <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} style={{padding:'6px 14px', borderRadius:4, border:'1px solid #353a42', background:'var(--gh-table-header-bg, #2d323b)', color:'var(--gh-table-header-text, #fff)', cursor: table.getCanPreviousPage() ? 'pointer' : 'not-allowed'}}>Previous</button>
          <span style={{margin:'0 8px', fontSize:14, color:'var(--gh-table-text, #e0e0e0)'}}>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} style={{padding:'6px 14px', borderRadius:4, border:'1px solid #353a42', background:'var(--gh-table-header-bg, #2d323b)', color:'var(--gh-table-header-text, #fff)', cursor: table.getCanNextPage() ? 'pointer' : 'not-allowed'}}>Next</button>
        </div>
      )}
    </div>
  );
}
