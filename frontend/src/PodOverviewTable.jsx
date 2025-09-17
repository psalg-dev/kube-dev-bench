import React, { useEffect, useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { GetRunningPods } from '../wailsjs/go/main/App';

export default function PodOverviewTable({ namespace }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [columnFilters, setColumnFilters] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    GetRunningPods(namespace)
      .then(pods => {
        if (mounted) setData(pods || []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [namespace]);

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Pod Name',
      filterFn: 'includesString',
    },
    {
      accessorKey: 'uptime',
      header: 'Uptime',
    },
  ], []);

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
      <div style={{marginBottom:12, display:'flex', alignItems:'center', gap:8}}>
        <input
          type="text"
          value={table.getColumn('name')?.getFilterValue() ?? ''}
          onChange={e => table.getColumn('name')?.setFilterValue(e.target.value)}
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
