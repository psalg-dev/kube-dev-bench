import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import * as AppAPI from '../../../wailsjs/go/main/App';
import CodeMirrorEditor from '../../components/CodeMirrorEditor';
import { getCodeMirrorLanguageExtensions } from '../../utils/codeMirrorLanguage.js';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting.js';

// Minimal file browser for PVCs (Enhanced)
// Props: namespace, pvcName
export default function FilesTab({ namespace, pvcName }) {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileContent, setFileContent] = useState(null); // {path, text, truncated, isBinary, size}
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const columns = useMemo(() => ([
    { key: 'name', label: 'Name' },
    { key: 'mode', label: 'Perms' },
    { key: 'size', label: 'Size' },
    { key: 'modified', label: 'Modified' },
  ]), []);
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState(() => ({ key: defaultSortKey, direction: 'asc' }));

  const languageExtensions = useMemo(
    () => getCodeMirrorLanguageExtensions(fileContent?.path, fileContent?.text),
    [fileContent?.path, fileContent?.text]
  );

  const iconFor = (e) => {
    if (e.isDir) return '📁';
    if (e.isSymlink) return '🔗';
    // simple heuristic by extension
    const name = e.name.toLowerCase();
    if (name.endsWith('.log')) return '🧾';
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return '📝';
    if (name.endsWith('.json')) return '🗂';
    if (name.endsWith('.sh')) return '🐚';
    if (name.endsWith('.txt')) return '📄';
    return '📦';
  };

  const humanSize = (n) => {
    if (n === '-' || n == null) return '-';
    const num = Number(n);
    if (isNaN(num)) return n;
    if (num < 1024) return num + ' B';
    const units = ['KiB','MiB','GiB','TiB'];
    let v = num; let u = -1;
    while (v >= 1024 && u < units.length-1) { v/=1024; u++; }
    return v.toFixed(1)+' '+units[u];
  };

  const loadDir = useCallback(async (targetPath) => {
    if (!namespace || !pvcName) return;
    setLoading(true);
    setError(null);
    setFileContent(null);
    setContentError(null);
    try {
      const list = await AppAPI.ListPVCFiles(namespace, pvcName, targetPath);
      setEntries(Array.isArray(list) ? list : []);
      setPath(targetPath);
    } catch (e) {
      setError(e?.message || String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [namespace, pvcName]);

  useEffect(() => { loadDir('/'); }, [loadDir]);

  const breadcrumbs = path === '/' ? [''] : path.split('/').filter(Boolean);

  useEffect(() => {
    if (!defaultSortKey) return;
    setSortState((cur) => (cur?.key ? cur : { key: defaultSortKey, direction: 'asc' }));
  }, [defaultSortKey]);

  const handleCrumbClick = (idx) => {
    if (idx === -1) { loadDir('/'); return; }
    const newPath = '/' + breadcrumbs.slice(0, idx + 1).join('/');
    loadDir(newPath === '' ? '/' : newPath);
  };

  const openEntry = (entry) => { if (entry.isDir) { loadDir(entry.path); } else { fetchFile(entry.path); } };

  const fetchFile = async (filePath) => {
    setContentLoading(true); setContentError(null); setFileContent(null);
    try {
      const res = await AppAPI.GetPVCFileContent(namespace, pvcName, filePath, 262144); // 256KiB cap
      let text = '';
      if (!res.isBinary) {
        try { text = atob(res.base64 || ''); } catch (_e) { text = '[decode error]'; }
      }
      const fc = { path: res.path, truncated: !!res.truncated, isBinary: !!res.isBinary, size: res.size, text };
      setFileContent(fc);
      // Editor renders via CodeMirrorEditor
    } catch (e) {
      setContentError(e?.message || String(e));
    } finally {
      setContentLoading(false);
    }
  };

  const downloadArchive = async (targetPath, _singleFile = false) => {
    setDownloadError(null); setDownloading(true);
    try {
      const res = await AppAPI.ArchivePVCPath(namespace, pvcName, targetPath, 0); // 0 => no enforced cap here
      const blob = base64TarToBlob(res.base64);
      const nameSeg = targetPath === '/' ? 'root' : targetPath.split('/').filter(Boolean).pop();
      const filename = `${pvcName}-${nameSeg || 'root'}.tar.gz`;
      triggerBlobDownload(blob, filename);
      if (res.truncated) setDownloadError('Archive truncated by server limit');
    } catch (e) {
      setDownloadError(e?.message || String(e));
    } finally {
      setDownloading(false);
    }
  };

  const base64TarToBlob = (b64) => {
    try {
      const bytes = Uint8Array.from(atob(b64 || ''), c => c.charCodeAt(0));
      return new Blob([bytes], { type: 'application/gzip' });
    } catch (_e) {
      return new Blob([]);
    }
  };

  const triggerBlobDownload = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  };

  const _currentEntry = (fileContent && entries.find(e => e.path === fileContent.path)) || null;
  const sortedEntries = useMemo(() => {
    return sortRows(entries, sortState.key, sortState.direction, (row, key) => {
      if (key === 'size') return row?.isDir ? null : row?.size;
      return row?.[key];
    });
  }, [entries, sortState]);

  const headerButtonStyle = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    textAlign: 'left',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header / breadcrumbs */}
      <div style={{ padding: '8px 12px', background: 'var(--gh-bg-alt,#161b22)', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>Files</span>
        <div style={{ fontSize: 12, color: 'var(--gh-text-muted,#8b949e)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => handleCrumbClick(-1)}>root</span>
          {breadcrumbs.map((b, idx) => (
            <Fragment key={idx}>
              <span style={{ margin: '0 4px' }}>/</span>
              <span style={{ cursor: 'pointer' }} onClick={() => handleCrumbClick(idx)}>{b}</span>
            </Fragment>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button disabled={downloading || loading} style={btnStyle} onClick={() => downloadArchive(path)}>
            {downloading ? 'Archiving...' : 'Download Dir (.tar.gz)'}
          </button>
          {fileContent && !fileContent.isBinary && (
            <button disabled={downloading} style={btnStyle} onClick={() => downloadArchive(fileContent.path, true)}>Download File (.tar.gz)</button>
          )}
        </div>
      </div>
      {downloadError && <div style={{ padding: '4px 12px', background: '#2d1f1f', color: '#f85149', fontSize: 12 }}>{downloadError}</div>}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: directory listing */}
        <div style={{ width: '50%', minWidth: 300, borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>
          {loading && (<div style={{ padding: 12, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>Loading directory...</div>)}
          {error && (<div style={{ padding: 12, fontSize: 13, color: '#f85149' }}>Error: {error}</div>)}
          {!loading && !error && entries.length === 0 && (<div style={{ padding: 12, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>Empty directory or not accessible.</div>)}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: '#161b22' }}>
                  <th style={thStyle} aria-sort={sortState.key === 'name' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'name'))}>
                      <span>Name</span>
                      <span aria-hidden="true">{sortState.key === 'name' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th style={thStyle} aria-sort={sortState.key === 'mode' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'mode'))}>
                      <span>Perms</span>
                      <span aria-hidden="true">{sortState.key === 'mode' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }} aria-sort={sortState.key === 'size' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" style={{ ...headerButtonStyle, justifyContent: 'flex-end' }} onClick={() => setSortState((cur) => toggleSortState(cur, 'size'))}>
                      <span>Size</span>
                      <span aria-hidden="true">{sortState.key === 'size' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th style={thStyle} aria-sort={sortState.key === 'modified' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'modified'))}>
                      <span>Modified</span>
                      <span aria-hidden="true">{sortState.key === 'modified' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map(e => (
                  <tr key={e.path} onClick={() => openEntry(e)} style={{ cursor: 'pointer' }} className={e.isDir ? 'dir-row' : 'file-row'}>
                    <td style={{ padding: '4px 8px', color: e.isDir ? '#58a6ff' : 'var(--gh-text,#c9d1d9)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>{iconFor(e)}</span>
                      <span>{e.name}{e.isSymlink && e.linkTarget ? <span style={{ color: '#8b949e' }}> ➜ {e.linkTarget}</span> : null}</span>
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--gh-text-muted,#8b949e)', whiteSpace: 'nowrap' }}>{e.mode || ''}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--gh-text-muted,#8b949e)' }}>{e.isDir ? '-' : humanSize(e.size)}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--gh-text-muted,#8b949e)' }}>{e.modified ? e.modified.replace('T', ' ') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Right: file preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!fileContent && !contentLoading && !contentError && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>
              Select a file to preview (text up to 256 KiB). Binary files not shown. Helper pod may auto‑start if none mounts this PVC.
            </div>
          )}
          {contentLoading && (<div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>Loading file...</div>)}
          {contentError && (<div style={{ padding: 16, fontSize: 13, color: '#f85149' }}>Error: {contentError}</div>)}
          {fileContent && !fileContent.isBinary && (
            <CodeMirrorEditor
              value={fileContent.text || ''}
              language="yaml"
              languageExtensions={languageExtensions}
              readOnly={true}
              lineNumbers={true}
              foldGutter={true}
              lineWrapping={true}
              highlightActiveLine={false}
              height="100%"
            />
          )}
            </div>
          )}
          {fileContent && !fileContent.isBinary && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '6px 10px', background: '#161b22', borderBottom: '1px solid #30363d', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileContent.path}</span>
                <span style={{ color: 'var(--gh-text-muted,#8b949e)' }}>{humanSize(fileContent.size)}{fileContent.truncated ? ' (truncated)' : ''}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <div ref={editorParentRef} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: 'var(--gh-accent,#238636)',
  color: '#fff',
  border: '1px solid #2ea043',
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600
};

const thStyle = { textAlign: 'left', padding: '4px 8px', fontWeight: 500, whiteSpace: 'nowrap' };
