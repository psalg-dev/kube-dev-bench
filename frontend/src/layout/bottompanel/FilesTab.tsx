import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as AppAPI from '../../../wailsjs/go/main/App';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { foldGutter, foldKeymap, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../utils/tableSorting';

type FileEntry = {
  path: string;
  name: string;
  isDir?: boolean;
  isSymlink?: boolean;
  linkTarget?: string;
  mode?: string;
  size?: number;
  modified?: string;
};

type FileContent = {
  path: string;
  text: string;
  truncated: boolean;
  isBinary: boolean;
  size?: number;
};

type FilesTabProps = {
  namespace?: string;
  pvcName?: string;
};

type SortState = { key: string; direction: 'asc' | 'desc' };

export default function FilesTab({ namespace, pvcName }: FilesTabProps) {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const columns = useMemo(
    () => [
      { key: 'name', label: 'Name' },
      { key: 'mode', label: 'Perms' },
      { key: 'size', label: 'Size' },
      { key: 'modified', label: 'Modified' },
    ],
    []
  );
  const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
  const [sortState, setSortState] = useState<SortState>(() => ({
    key: defaultSortKey,
    direction: 'asc',
  }));

  const editorParentRef = useRef<HTMLDivElement | null>(null);
  const cmViewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef(new Compartment());

  const cmTheme = useMemo(
    () =>
      EditorView.theme(
        {
          '&': { backgroundColor: '#0d1117', color: '#c9d1d9' },
          '&.cm-editor': { height: '100%', width: '100%' },
          '.cm-scroller': {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: '1.4',
          },
          '.cm-gutters': { background: '#161b22', color: '#8b949e', borderRight: '1px solid #30363d' },
        },
        { dark: true }
      ),
    []
  );

  const cmExtensions = useMemo(
    () => [
      cmTheme,
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      keymap.of(foldKeymap),
      languageCompartmentRef.current.of([]),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ],
    [cmTheme]
  );

  const initOrUpdateEditor = useCallback(
    (text: string, filePath = '') => {
      if (!editorParentRef.current) return;
      const lower = (filePath || '').toLowerCase();
      const languageExt = lower.endsWith('.yaml') || lower.endsWith('.yml') ? [yamlLang()] : [];
      if (!cmViewRef.current) {
        const state = EditorState.create({ doc: text || '', extensions: cmExtensions });
        cmViewRef.current = new EditorView({ state, parent: editorParentRef.current });
      }

      cmViewRef.current.dispatch({
        effects: languageCompartmentRef.current.reconfigure(languageExt),
        changes: { from: 0, to: cmViewRef.current.state.doc.length, insert: text || '' },
      });
    },
    [cmExtensions]
  );

  useEffect(
    () =>
      () => {
        if (cmViewRef.current) {
          try {
            cmViewRef.current.destroy();
          } catch {}
          cmViewRef.current = null;
        }
      },
    []
  );

  const iconFor = (e: FileEntry) => {
    if (e.isDir) return '📁';
    if (e.isSymlink) return '🔗';
    const name = e.name.toLowerCase();
    if (name.endsWith('.log')) return '🧾';
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return '📝';
    if (name.endsWith('.json')) return '🗂';
    if (name.endsWith('.sh')) return '🐚';
    if (name.endsWith('.txt')) return '📄';
    return '📦';
  };

  const humanSize = (n: number | string | null | undefined) => {
    if (n === '-' || n == null) return '-';
    const num = Number(n);
    if (isNaN(num)) return String(n);
    if (num < 1024) return `${num} B`;
    const units = ['KiB', 'MiB', 'GiB', 'TiB'];
    let v = num;
    let u = -1;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u++;
    }
    return `${v.toFixed(1)} ${units[u]}`;
  };

  const loadDir = useCallback(
    async (targetPath: string) => {
      if (!namespace || !pvcName) return;
      setLoading(true);
      setError(null);
      setFileContent(null);
      setContentError(null);
      try {
        const list = await AppAPI.ListPVCFiles(namespace, pvcName, targetPath);
        setEntries(Array.isArray(list) ? (list as FileEntry[]) : []);
        setPath(targetPath);
      } catch (e: unknown) {
        setError((e as Error)?.message || String(e));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [namespace, pvcName]
  );

  useEffect(() => {
    loadDir('/');
  }, [loadDir]);

  const breadcrumbs = path === '/' ? [''] : path.split('/').filter(Boolean);

  useEffect(() => {
    if (!defaultSortKey) return;
    setSortState((cur) => (cur?.key ? cur : { key: defaultSortKey, direction: 'asc' }));
  }, [defaultSortKey]);

  const handleCrumbClick = (idx: number) => {
    if (idx === -1) {
      loadDir('/');
      return;
    }
    const newPath = '/' + breadcrumbs.slice(0, idx + 1).join('/');
    loadDir(newPath === '' ? '/' : newPath);
  };

  const openEntry = (entry: FileEntry) => {
    if (entry.isDir) {
      loadDir(entry.path);
    } else {
      fetchFile(entry.path);
    }
  };

  const fetchFile = async (filePath: string) => {
    setContentLoading(true);
    setContentError(null);
    setFileContent(null);
    try {
      const res = await AppAPI.GetPVCFileContent(namespace || '', pvcName || '', filePath, 262144);
      let text = '';
      if (!res.isBinary) {
        try {
          text = atob(res.base64 || '');
        } catch {
          text = '[decode error]';
        }
      }
      const fc: FileContent = {
        path: res.path,
        truncated: !!res.truncated,
        isBinary: !!res.isBinary,
        size: res.size,
        text,
      };
      setFileContent(fc);
      if (!fc.isBinary) initOrUpdateEditor(fc.text, fc.path);
    } catch (e: unknown) {
      setContentError((e as Error)?.message || String(e));
    } finally {
      setContentLoading(false);
    }
  };

  const downloadArchive = async (targetPath: string) => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await AppAPI.ArchivePVCPath(namespace || '', pvcName || '', targetPath, 0);
      const blob = base64TarToBlob(res.base64);
      const nameSeg = targetPath === '/' ? 'root' : targetPath.split('/').filter(Boolean).pop();
      const filename = `${pvcName}-${nameSeg || 'root'}.tar.gz`;
      triggerBlobDownload(blob, filename);
      if (res.truncated) setDownloadError('Archive truncated by server limit');
    } catch (e: unknown) {
      setDownloadError((e as Error)?.message || String(e));
    } finally {
      setDownloading(false);
    }
  };

  const base64TarToBlob = (b64: string) => {
    try {
      const bytes = Uint8Array.from(atob(b64 || ''), (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: 'application/gzip' });
    } catch {
      return new Blob([]);
    }
  };

  const triggerBlobDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  };

  const sortedEntries = useMemo(() => {
    return sortRows(entries, sortState.key, sortState.direction, (row: FileEntry, key: string) => {
      if (key === 'size') return row?.isDir ? null : row?.size;
      return (row as Record<string, unknown>)?.[key];
    });
  }, [entries, sortState]);

  const headerButtonStyle: React.CSSProperties = {
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
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--gh-bg-alt,#161b22)',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 600 }}>Files</span>
        <div
          style={{
            fontSize: 12,
            color: 'var(--gh-text-muted,#8b949e)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ cursor: 'pointer' }} onClick={() => handleCrumbClick(-1)}>
            root
          </span>
          {breadcrumbs.map((b, idx) => (
            <Fragment key={idx}>
              <span style={{ margin: '0 4px' }}>/</span>
              <span style={{ cursor: 'pointer' }} onClick={() => handleCrumbClick(idx)}>
                {b}
              </span>
            </Fragment>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button disabled={downloading || loading} style={btnStyle} onClick={() => downloadArchive(path)}>
            {downloading ? 'Archiving...' : 'Download Dir (.tar.gz)'}
          </button>
          {fileContent && !fileContent.isBinary && (
            <button
              disabled={downloading}
              style={btnStyle}
              onClick={() => downloadArchive(fileContent.path, true)}
            >
              Download File (.tar.gz)
            </button>
          )}
        </div>
      </div>
      {downloadError && (
        <div style={{ padding: '4px 12px', background: '#2d1f1f', color: '#f85149', fontSize: 12 }}>
          {downloadError}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{ width: '50%', minWidth: 300, borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}
        >
          {loading && (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>
              Loading directory...
            </div>
          )}
          {error && (
            <div style={{ padding: 12, fontSize: 13, color: '#f85149' }}>Error: {error}</div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>
              Empty directory or not accessible.
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: '#161b22' }}>
                  <th
                    style={thStyle}
                    aria-sort={
                      sortState.key === 'name'
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      style={headerButtonStyle}
                      onClick={() => setSortState((cur) => toggleSortState(cur, 'name'))}
                    >
                      <span>Name</span>
                      <span aria-hidden="true">
                        {sortState.key === 'name' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th
                    style={thStyle}
                    aria-sort={
                      sortState.key === 'mode'
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      style={headerButtonStyle}
                      onClick={() => setSortState((cur) => toggleSortState(cur, 'mode'))}
                    >
                      <span>Perms</span>
                      <span aria-hidden="true">
                        {sortState.key === 'mode' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th
                    style={{ ...thStyle, textAlign: 'right' }}
                    aria-sort={
                      sortState.key === 'size'
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      style={{ ...headerButtonStyle, justifyContent: 'flex-end' }}
                      onClick={() => setSortState((cur) => toggleSortState(cur, 'size'))}
                    >
                      <span>Size</span>
                      <span aria-hidden="true">
                        {sortState.key === 'size' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th
                    style={thStyle}
                    aria-sort={
                      sortState.key === 'modified'
                        ? sortState.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      style={headerButtonStyle}
                      onClick={() => setSortState((cur) => toggleSortState(cur, 'modified'))}
                    >
                      <span>Modified</span>
                      <span aria-hidden="true">
                        {sortState.key === 'modified' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((e) => (
                  <tr
                    key={e.path}
                    onClick={() => openEntry(e)}
                    style={{ cursor: 'pointer' }}
                    className={e.isDir ? 'dir-row' : 'file-row'}
                  >
                    <td
                      style={{
                        padding: '4px 8px',
                        color: e.isDir ? '#58a6ff' : 'var(--gh-text,#c9d1d9)',
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      <span>{iconFor(e)}</span>
                      <span>
                        {e.name}
                        {e.isSymlink && e.linkTarget ? (
                          <span style={{ color: '#8b949e' }}> ➜ {e.linkTarget}</span>
                        ) : null}
                      </span>
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--gh-text-muted,#8b949e)', whiteSpace: 'nowrap' }}>
                      {e.mode || ''}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--gh-text-muted,#8b949e)' }}>
                      {e.isDir ? '-' : humanSize(e.size)}
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--gh-text-muted,#8b949e)' }}>
                      {e.modified ? e.modified.replace('T', ' ') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!fileContent && !contentLoading && !contentError && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>
              Select a file to preview (text up to 256 KiB). Binary files not shown. Helper pod may auto‑start if none mounts this PVC.
            </div>
          )}
          {contentLoading && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>
              Loading file...
            </div>
          )}
          {contentError && (
            <div style={{ padding: 16, fontSize: 13, color: '#f85149' }}>Error: {contentError}</div>
          )}
          {fileContent && fileContent.isBinary && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted,#8b949e)' }}>
              {fileContent.path} is a binary file ({humanSize(fileContent.size)}). Preview disabled. You can still download the directory or file as an archive.
            </div>
          )}
          {fileContent && !fileContent.isBinary && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div
                style={{
                  padding: '6px 10px',
                  background: '#161b22',
                  borderBottom: '1px solid #30363d',
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileContent.path}</span>
                <span style={{ color: 'var(--gh-text-muted,#8b949e)' }}>
                  {humanSize(fileContent.size)}{fileContent.truncated ? ' (truncated)' : ''}
                </span>
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

const btnStyle: React.CSSProperties = {
  background: 'var(--gh-accent,#238636)',
  color: '#fff',
  border: '1px solid #2ea043',
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

