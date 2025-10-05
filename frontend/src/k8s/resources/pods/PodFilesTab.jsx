import React, { useCallback, useEffect, useMemo, useState } from 'react';

/* PodFilesTab
 * Shows directory listing for a pod container.
 * Added features:
 *  - Search/filter current directory
 *  - File preview (up to 128KB) with truncation notice
 *  - Download file (attempts full size up to backend cap)
 *  - Row click: directories navigate, files open preview
 *  - Sliding preview panel full height
 */
export default function PodFilesTab({ podName }) {
  const [containers, setContainers] = useState([]);
  const [container, setContainer] = useState('');
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [filter, setFilter] = useState('');
  const [previewPath, setPreviewPath] = useState(null);
  const [previewData, setPreviewData] = useState(null); // { base64, size, truncated, isBinary }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [searchInProgress, setSearchInProgress] = useState(false);
  const api = useMemo(() => window?.go?.main?.App || {}, []);

  // Load containers when pod changes
  useEffect(() => {
    if (!podName) return;
    setLoadingContainers(true);
    setError(null);
    (async () => {
      try {
        const fn = api.GetPodContainers;
        if (typeof fn !== 'function') throw new Error('GetPodContainers API not available. Rebuild backend.');
        const list = await fn(podName);
        setContainers(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) {
          setContainer(prev => (prev && list.includes(prev) ? prev : list[0]));
        }
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoadingContainers(false);
      }
    })();
  }, [podName, api]);

  // Reset path when container changes
  useEffect(() => { setPath('/'); }, [container, podName]);

  const load = useCallback(async () => {
    if (!podName || !container) return;
    setLoading(true);
    setError(null);
    try {
      const fn = api.GetPodFiles;
      if (typeof fn !== 'function') throw new Error('GetPodFiles API not available. Rebuild backend.');
      const res = await fn(podName, container, path);
      setEntries(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(String(e?.message || e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [api, podName, container, path]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (previewPath) { /* close preview when container or path root changes */ } }, [container]);
  useEffect(() => { /* close preview when navigating dirs */ if (previewPath && previewPath.startsWith(path) === false) { setPreviewPath(null); setPreviewData(null); setPreviewError(null);} }, [path]);

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const f = filter.toLowerCase();
    return entries.filter(e => (e.name || e.Name || '').toLowerCase().includes(f));
  }, [entries, filter]);

  const humanSize = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    const units = ['KB','MB','GB','TB'];
    let v = bytes / 1024; let i=0;
    while (v >= 1024 && i < units.length-1) { v /= 1024; i++; }
    return v.toFixed(v < 10 ? 1 : 0) + ' ' + units[i];
  };

  const formatCreated = (epoch) => {
    if (!epoch || epoch <= 0) return '-';
    try {
      const d = new Date(epoch * 1000);
      // YYYY-MM-DD HH:MM:SS
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch { return '-'; }
  };

  const closePreview = () => { setPreviewPath(null); setPreviewData(null); setPreviewError(null); };

  const openFile = async (fullPath) => {
    if (!podName || !container || !fullPath) return;
    setPreviewPath(fullPath);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const fn = api.GetPodFileContent;
      if (typeof fn !== 'function') throw new Error('GetPodFileContent API not available. Rebuild backend.');
      const res = await fn(podName, container, fullPath, 131072);
      setPreviewData(res || null);
    } catch (e) {
      setPreviewError(String(e?.message || e));
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!previewPath || !podName || !container) return;
    try {
      const fn = api.GetPodFileContent;
      if (typeof fn !== 'function') throw new Error('GetPodFileContent API not available.');
      const maxBytes = previewData?.size ? previewData.size : 5*1024*1024;
      const fullRes = await fn(podName, container, previewPath, maxBytes);
      const b64 = fullRes?.base64 || fullRes?.Base64;
      if (!b64) throw new Error('No data returned');
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const name = previewPath.split('/').filter(Boolean).slice(-1)[0] || 'download';
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    } catch (e) {
      setPreviewError(`Download failed: ${e?.message || e}`);
    }
  };

  const decodeText = (b64) => {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
      const td = new TextDecoder('utf-8', { fatal: false });
      return td.decode(bytes);
    } catch (_) { return '[decode error]'; }
  };

  const breadcrumbs = useMemo(() => {
    const parts = path === '/' ? [] : path.split('/').filter(Boolean);
    const acc = ['/'];
    let cur = '';
    for (const p of parts) { cur += '/' + p; acc.push(cur); }
    return acc;
  }, [path]);

  const goUp = () => {
    if (path === '/' || !path) return;
    const parts = path.split('/').filter(Boolean); parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    setPath(newPath);
  };

  const onBreadcrumbClick = (p) => setPath(p);

  const startRecursiveSearch = async () => {
    const q = searchQuery.trim();
    if (!q) { setSearchError('Enter search text'); return; }
    if (!podName || !container) return;
    setSearchError('');
    setSearchInProgress(true);
    setSearching(true);
    try {
      const fn = api.SearchPodFiles;
      if (typeof fn !== 'function') throw new Error('SearchPodFiles API not available');
      // depth 0 unlimited, maxResults 500 for safety
      const res = await fn(podName, container, path, q, 0, 500);
      setSearchResults(Array.isArray(res) ? res : []);
    } catch (e) {
      setSearchError(String(e?.message || e));
      setSearchResults([]);
    } finally {
      setSearchInProgress(false);
    }
  };
  const clearSearch = () => {
    setSearching(false);
    setSearchResults([]);
    setSearchError('');
  };

  // Derived listing (normal vs recursive search results)
  const activeListing = useMemo(() => (searching ? searchResults : filteredEntries), [searching, searchResults, filteredEntries]);

  // Row click handler centralised
  const handleRowClick = (isDir, fullPath) => {
    if (isDir) { setPath(fullPath); return; }
    openFile(fullPath);
  };

  // UI RENDER
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-sidebar, #161b22)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>Files for {podName}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#aaa' }}>Container:</label>
          <select value={container} disabled={loadingContainers} onChange={e => setContainer(e.target.value)} style={{ background:'#23272e', color:'#fff', border:'1px solid #353a42', padding:'4px 6px', fontSize:13 }}>
            {containers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex:1, minWidth: 200, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize: 12, color:'#aaa' }}>Path:</span>
          <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
            {breadcrumbs.map((bp, idx) => {
              const label = bp === '/' ? '/' : bp.split('/').filter(Boolean).slice(-1)[0];
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span key={bp} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <button disabled={isLast} onClick={() => onBreadcrumbClick(bp)} style={{ cursor: isLast ? 'default':'pointer', background:'transparent', border:'none', color: isLast ? '#fff':'#4aa3ff', padding:0, fontSize:13 }}>{label}</button>
                  {!isLast && <span style={{ color:'#666' }}>/</span>}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type='search' value={filter} placeholder='Filter…' onChange={e=>setFilter(e.target.value)} disabled={searching} style={{ background:'#23272e', color:'#fff', border:'1px solid #353a42', padding:'4px 6px', fontSize:13, minWidth:140 }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type='text' value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder='Recursive search' style={{ background:'#23272e', color:'#fff', border:'1px solid #353a42', padding:'4px 6px', fontSize:13, minWidth:160 }} />
          {!searching && <button onClick={startRecursiveSearch} disabled={searchInProgress || !searchQuery.trim()} style={{ padding:'4px 10px', background:'#2d7ef7', border:'1px solid #1f5bb8', color:'#fff', fontSize:12, cursor: searchInProgress? 'not-allowed':'pointer' }}>{searchInProgress? 'Searching…':'Search'}</button>}
          {searching && <button onClick={clearSearch} style={{ padding:'4px 10px', background:'#444c56', border:'1px solid #353a42', color:'#fff', fontSize:12, cursor:'pointer' }}>Exit Search</button>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={goUp} disabled={path === '/' || loading} style={{ padding:'4px 10px', background:'#30363d', border:'1px solid #353a42', color:'#fff', cursor: path === '/' || loading ? 'not-allowed':'pointer', fontSize:12 }}>Up</button>
          <button onClick={load} disabled={loading} style={{ padding:'4px 10px', background:'#238636', border:'1px solid #2ea043', color:'#fff', cursor: loading ? 'not-allowed':'pointer', fontSize:12 }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      {/* Body */}
      {error && <div style={{ padding:12, color:'#f85149' }}>Error: {error}</div>}
      {!error && (
        <div style={{ flex:1, minHeight:0, position:'relative', display:'flex' }}>
          {/* Listing area */}
          <div style={{ flex:1, minWidth:0, overflow:'auto', padding:12 }}>
            {searchError && searching && <div style={{ color:'#f85149', marginBottom:8 }}>{searchError}</div>}
            {loading && !searching && activeListing.length === 0 && <div style={{ color:'#888' }}>Loading…</div>}
            {!loading && activeListing.length === 0 && <div style={{ color:'#888' }}>{searching? 'No matches.' : 'No entries.'}</div>}
            {activeListing.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42' }}>
                      <span style={{ display:'inline-block', width:20 }}></span>
                      Name
                    </th>
                    <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42' }}>Type</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', width:90 }}>Size</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', width:160 }}>Created</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42' }}>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {activeListing.map(e => {
                    const name = e.name || e.Name;
                    const isDir = !!(e.isDir || e.IsDir);
                    const fullPath = e.path || e.Path;
                    const mode = (e.mode || e.Mode || (isDir ? 'dir' : 'file'));
                    const size = Number(e.size ?? e.Size);
                    return (
                      <tr
                        key={fullPath+(searching? '|search':'')}
                        onClick={() => handleRowClick(isDir, fullPath)}
                        style={{ cursor: 'pointer', transition:'background 0.12s', background: previewPath===fullPath? 'rgba(56,139,253,0.12)' : 'transparent' }}
                        onMouseEnter={ev => ev.currentTarget.style.background = previewPath===fullPath? 'rgba(56,139,253,0.12)' : '#1a2027'}
                        onMouseLeave={ev => ev.currentTarget.style.background = previewPath===fullPath? 'rgba(56,139,253,0.12)' : 'transparent'}
                      >
                        <td style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', color:'#e0e0e0' }}>
                          <span style={{ display:'inline-block', width:20, textAlign:'center' }}>{isDir ? '📁' : (mode==='symlink' ? '🔗' : '📄')}</span>
                          <span style={{ marginLeft:4 }}>{name}</span>
                        </td>
                        <td style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', color:isDir ? '#4aa3ff':'#aaa', textTransform:'capitalize' }}>{mode}</td>
                        <td style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', fontFamily:'monospace', fontSize:12, color:'#bbb' }}>{isDir? '-': humanSize(size)}</td>
                        <td style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', fontFamily:'monospace', fontSize:12, color:'#bbb', whiteSpace:'nowrap' }}>{formatCreated(Number(e.created ?? e.Created))}</td>
                        <td style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #353a42', fontFamily:'monospace', fontSize:12, color:'#bbb' }}>{fullPath}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Sliding Preview Panel absolute full height */}
          <div style={{ position:'absolute', top:0, right:0, bottom:0, width:'45%', minWidth:360, maxWidth:780, background:'#0d1117', borderLeft:'1px solid #353a42', boxShadow:'-4px 0 12px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', transform: previewPath? 'translateX(0)' : 'translateX(100%)', transition:'transform 0.25s ease-out' }}>
            {previewPath && (
              <>
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #353a42', display:'flex', alignItems:'center', gap:10 }}>
                  <strong style={{ flex:1, color:'#fff', fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{previewPath.split('/').filter(Boolean).slice(-1)[0]}</strong>
                  {previewLoading && <span style={{ color:'#888', fontSize:12 }}>Loading…</span>}
                  {!previewLoading && previewData && previewData.truncated && <span style={{ color:'#d29922', fontSize:11 }} title='Preview truncated'>TRUNCATED</span>}
                  <button onClick={downloadFile} disabled={previewLoading} style={{ padding:'4px 8px', background:'#238636', border:'1px solid #2ea043', color:'#fff', fontSize:12, cursor:previewLoading?'not-allowed':'pointer' }}>Download</button>
                  <button onClick={closePreview} style={{ padding:'4px 8px', background:'transparent', border:'1px solid #353a42', color:'#fff', fontSize:14, cursor:'pointer' }}>✕</button>
                </div>
                <div style={{ flex:1, overflow:'auto', padding:12, fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize:12, lineHeight:1.4, whiteSpace:'pre', color:'#e0e0e0' }}>
                  {previewError && <div style={{ color:'#f85149' }}>{previewError}</div>}
                  {!previewError && previewLoading && <div style={{ color:'#888' }}>Loading…</div>}
                  {!previewLoading && previewData && (
                    previewData.isBinary ? (
                      <div style={{ color:'#bbb' }}>Binary file preview not shown. Download to view. {previewData.truncated && '(Truncated preview size)'} </div>
                    ) : (
                      <>{decodeText(previewData.base64 || previewData.Base64)}</>
                    )
                  )}
                  {!previewLoading && !previewError && !previewData && <div style={{ color:'#888' }}>No data.</div>}
                </div>
                {previewData && (
                  <div style={{ padding:'6px 10px', borderTop:'1px solid #353a42', fontSize:11, color:'#888', display:'flex', gap:12, flexWrap:'wrap' }}>
                    <span>Size: {previewData.size || previewData.Size || 0} bytes</span>
                    <span>Status: {previewData.truncated ? 'Truncated preview' : 'Complete'}</span>
                    <span>Type: {previewData.isBinary ? 'Binary' : 'Text'}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
