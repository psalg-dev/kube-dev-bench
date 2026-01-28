import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import {
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import { yaml as yamlLang } from '@codemirror/lang-yaml';

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
  const [previewWidth, setPreviewWidth] = useState(null); // pixels
  const [resizing, setResizing] = useState(false);
  // New copy-to-clipboard UI state
  const [copyState, setCopyState] = useState('idle'); // idle | copied | error
  const [copyError, setCopyError] = useState('');
  const rootRef = useRef(null);
  // Refs for CodeMirror preview
  const previewEditorParentRef = useRef(null);
  const previewEditorViewRef = useRef(null);
  const previewLanguageCompartmentRef = useRef(new Compartment());
  const MIN_PREVIEW_WIDTH = 360;
  const MAX_PREVIEW_WIDTH_RATIO = 0.75; // 75% of available width
  const getDynamicMaxWidth = () => {
    if (!rootRef.current) return 780; // fallback
    const rect = rootRef.current.getBoundingClientRect();
    return Math.max(
      MIN_PREVIEW_WIDTH,
      Math.floor(rect.width * MAX_PREVIEW_WIDTH_RATIO),
    );
  };
  const LS_KEY = 'kdb.podFiles.previewWidth';
  const api = useMemo(() => window?.go?.main?.App || {}, []);

  // Load persisted width
  useEffect(() => {
    const stored = Number(localStorage.getItem(LS_KEY));
    if (Number.isFinite(stored)) {
      // Clamp to current dynamic max
      const max = getDynamicMaxWidth();
      const clamped = Math.min(max, Math.max(MIN_PREVIEW_WIDTH, stored));
      setPreviewWidth(clamped);
    }
  }, []);

  // If panel opens first time and width not set, derive from 75% of container (clamped)
  useEffect(() => {
    if (previewPath && previewWidth == null && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      // Default initial width now 75% (previously 45%) to satisfy requirement
      const derived = Math.round(rect.width * 0.75);
      const max = getDynamicMaxWidth();
      const clamped = Math.min(max, Math.max(MIN_PREVIEW_WIDTH, derived));
      setPreviewWidth(clamped);
    }
  }, [previewPath, previewWidth]);

  // Adjust stored width if window resizes and exceeds new dynamic max
  useEffect(() => {
    const handleResize = () => {
      const max = getDynamicMaxWidth();
      setPreviewWidth((prev) => (prev != null && prev > max ? max : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist width
  useEffect(() => {
    if (previewWidth != null)
      localStorage.setItem(LS_KEY, String(previewWidth));
  }, [previewWidth]);

  // Resize handlers
  const onMouseMove = useCallback(
    (e) => {
      if (!resizing || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const dynamicMax = getDynamicMaxWidth();
      // Width = distance from cursor to right edge
      const newWidth = rect.right - e.clientX;
      const clamped = Math.min(
        dynamicMax,
        Math.max(MIN_PREVIEW_WIDTH, newWidth),
      );
      setPreviewWidth(clamped);
    },
    [resizing],
  );

  const stopResizing = useCallback(() => setResizing(false), []);
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('mouseleave', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('mouseleave', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('mouseleave', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, onMouseMove, stopResizing]);

  const startResizing = (e) => {
    e.preventDefault();
    if (!previewPath) return; // only allow when panel visible
    setResizing(true);
  };

  // Load containers when pod changes
  useEffect(() => {
    if (!podName) return;
    setLoadingContainers(true);
    setError(null);
    (async () => {
      try {
        const fn = api.GetPodContainers;
        if (typeof fn !== 'function')
          throw new Error(
            'GetPodContainers API not available. Rebuild backend.',
          );
        const list = await fn(podName);
        setContainers(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) {
          setContainer((prev) =>
            prev && list.includes(prev) ? prev : list[0],
          );
        }
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoadingContainers(false);
      }
    })();
  }, [podName, api]);

  // Reset path when container changes
  useEffect(() => {
    setPath('/');
  }, [container, podName]);

  const load = useCallback(async () => {
    if (!podName || !container) return;
    setLoading(true);
    setError(null);
    try {
      const fn = api.GetPodFiles;
      if (typeof fn !== 'function')
        throw new Error('GetPodFiles API not available. Rebuild backend.');
      const res = await fn(podName, container, path);
      setEntries(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(String(e?.message || e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [api, podName, container, path]);

  useEffect(() => {
    load();
  }, [load]);


  useEffect(() => {
    if (previewPath) {
      /* close preview when container or path root changes */
    }
  }, [container, previewPath]);

  useEffect(() => {
    /* close preview when navigating dirs */
    if (previewPath && previewPath.startsWith(path) === false) {
      setPreviewPath(null);
      setPreviewData(null);
      setPreviewError(null);
    }
  }, [path, previewPath]);

  const filteredEntries = useMemo(() => {
    if (!filter) return entries;
    const f = filter.toLowerCase();
    return entries.filter((e) =>
      (e.name || e.Name || '').toLowerCase().includes(f),
    );
  }, [entries, filter]);

  const humanSize = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return v.toFixed(v < 10 ? 1 : 0) + ' ' + units[i];
  };

  const formatCreated = (epoch) => {
    if (!epoch || epoch <= 0) return '-';
    try {
      const d = new Date(epoch * 1000);
      // YYYY-MM-DD HH:MM:SS
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return '-';
    }
  };

  // Copy preview content (only for non-binary text previews)
  const copyPreview = useCallback(async () => {
    if (!previewData || previewData.isBinary) return;
    setCopyError('');
    try {
      const text = decodeText(previewData.base64 || previewData.Base64 || '');
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for environments without async clipboard
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1800);
    } catch (e) {
      setCopyError(e?.message || String(e));
      setCopyState('error');
      setTimeout(() => {
        setCopyState('idle');
        setCopyError('');
      }, 3000);
    }
  }, [previewData]);

  const closePreview = () => {
    setPreviewPath(null);
    setPreviewData(null);
    setPreviewError(null);
    setCopyState('idle');
    setCopyError('');
  };

  const openFile = async (fullPath) => {
    if (!podName || !container || !fullPath) return;
    setPreviewPath(fullPath);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const fn = api.GetPodFileContent;
      if (typeof fn !== 'function')
        throw new Error(
          'GetPodFileContent API not available. Rebuild backend.',
        );
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
      if (typeof fn !== 'function')
        throw new Error('GetPodFileContent API not available.');
      const maxBytes = previewData?.size ? previewData.size : 5 * 1024 * 1024;
      const fullRes = await fn(podName, container, previewPath, maxBytes);
      const b64 = fullRes?.base64 || fullRes?.Base64;
      if (!b64) throw new Error('No data returned');
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++)
        byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: 'application/octet-stream',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const name =
        previewPath.split('/').filter(Boolean).slice(-1)[0] || 'download';
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
    } catch (e) {
      setPreviewError(`Download failed: ${e?.message || e}`);
    }
  };

  const decodeText = (b64) => {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const td = new TextDecoder('utf-8', { fatal: false });
      return td.decode(bytes);
    } catch (_) {
      return '[decode error]';
    }
  };

  const breadcrumbs = useMemo(() => {
    const parts = path === '/' ? [] : path.split('/').filter(Boolean);
    const acc = ['/'];
    let cur = '';
    for (const p of parts) {
      cur += '/' + p;
      acc.push(cur);
    }
    return acc;
  }, [path]);

  const goUp = () => {
    if (path === '/' || !path) return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    setPath(newPath);
  };

  const onBreadcrumbClick = (p) => setPath(p);

  const startRecursiveSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchError('Enter search text');
      return;
    }
    if (!podName || !container) return;
    setSearchError('');
    setSearchInProgress(true);
    setSearching(true);
    try {
      const fn = api.SearchPodFiles;
      if (typeof fn !== 'function')
        throw new Error('SearchPodFiles API not available');
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
  const activeListing = useMemo(
    () => (searching ? searchResults : filteredEntries),
    [searching, searchResults, filteredEntries],
  );

  // Row click handler centralised
  const handleRowClick = (isDir, fullPath) => {
    if (isDir) {
      setPath(fullPath);
      return;
    }
    openFile(fullPath);
  };

  // Escape key handling: when preview panel is open, Escape should only close it
  useEffect(() => {
    if (!previewPath) return; // Only listen when open
    const handler = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        // Close only the preview, do not let parent bottom panel receive this
        e.stopPropagation();
        e.preventDefault();
        if (resizing) setResizing(false);
        closePreview();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [previewPath, resizing]);

  // CodeMirror theme for file preview (read-only)
  const previewCMTheme = useMemo(() => {
    return EditorView.theme(
      {
        '&': { backgroundColor: '#0d1117', color: '#c9d1d9' },
        '&.cm-editor': { height: '100%', width: '100%' },
        '.cm-content': { caretColor: 'transparent', textAlign: 'left' },
        '.cm-line': {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '12px',
          textAlign: 'left',
        },
        '.cm-scroller': { lineHeight: '1.42' },
        '.cm-gutters': {
          background: '#161b22',
          color: '#8b949e',
          borderRight: '1px solid #30363d',
        },
        '.cm-gutterElement': { padding: '0 6px' },
      },
      { dark: true },
    );
  }, []);

  // Effect to create/update/destroy CodeMirror instance for preview
  useEffect(() => {
    // Conditions where we should not have an editor
    if (
      !previewPath ||
      !previewData ||
      previewLoading ||
      previewError ||
      previewData.isBinary
    ) {
      if (previewEditorViewRef.current) {
        try {
          previewEditorViewRef.current.destroy();
        } catch (_) {}
        previewEditorViewRef.current = null;
      }
      return;
    }
    if (!previewEditorParentRef.current) return;

    const text = (() => {
      try {
        return decodeText(previewData.base64 || previewData.Base64 || '');
      } catch {
        return '[decode error]';
      }
    })();

    // Create editor if missing
    if (!previewEditorViewRef.current) {
      try {
        const lower = (previewPath || '').toLowerCase();
        const languageExt =
          lower.endsWith('.yaml') || lower.endsWith('.yml') ? [yamlLang()] : [];
        const state = EditorState.create({
          doc: text,
          extensions: [
            previewCMTheme,
            lineNumbers(),
            foldGutter(),
            keymap.of(foldKeymap),
            previewLanguageCompartmentRef.current.of(languageExt),
            syntaxHighlighting(defaultHighlightStyle),
            EditorView.lineWrapping,
            EditorState.readOnly.of(true),
            EditorView.editable.of(false),
          ],
        });
        previewEditorViewRef.current = new EditorView({
          state,
          parent: previewEditorParentRef.current,
        });
      } catch (e) {
        console.error('Failed to init CodeMirror preview:', e);
      }
    } else {
      // Update doc if changed
      const view = previewEditorViewRef.current;
      const lower = (previewPath || '').toLowerCase();
      const languageExt =
        lower.endsWith('.yaml') || lower.endsWith('.yml') ? [yamlLang()] : [];
      const current = view.state.doc.toString();
      if (current !== text) {
        view.dispatch({
          effects:
            previewLanguageCompartmentRef.current.reconfigure(languageExt),
          changes: { from: 0, to: current.length, insert: text },
        });
      } else {
        view.dispatch({
          effects:
            previewLanguageCompartmentRef.current.reconfigure(languageExt),
        });
      }
    }

    return () => {
      // If previewPath changes to another file while still open, we'll rebuild or update above.
    };
  }, [previewPath, previewData, previewLoading, previewError, previewCMTheme]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (previewEditorViewRef.current) {
        try {
          previewEditorViewRef.current.destroy();
        } catch (_) {}
        previewEditorViewRef.current = null;
      }
    },
    [],
  );

  // UI RENDER
  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        // Disable text selection while resizing
        userSelect: resizing ? 'none' : undefined,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--gh-border, #30363d)',
          background: 'var(--gh-bg-sidebar, #161b22)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ color: 'var(--gh-text, #c9d1d9)' }}>
          Files for {podName}
        </strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#aaa' }}>Container:</label>
          <select
            value={container}
            disabled={loadingContainers}
            onChange={(e) => setContainer(e.target.value)}
            style={{
              background: '#23272e',
              color: '#fff',
              border: '1px solid #353a42',
              padding: '4px 6px',
              fontSize: 13,
            }}
          >
            {containers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: '#aaa' }}>Path:</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            {breadcrumbs.map((bp, idx) => {
              const label =
                bp === '/' ? '/' : bp.split('/').filter(Boolean).slice(-1)[0];
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span
                  key={bp}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <button
                    disabled={isLast}
                    onClick={() => onBreadcrumbClick(bp)}
                    style={{
                      cursor: isLast ? 'default' : 'pointer',
                      background: 'transparent',
                      border: 'none',
                      color: isLast ? '#fff' : '#4aa3ff',
                      padding: 0,
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </button>
                  {!isLast && <span style={{ color: '#666' }}>/</span>}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={filter}
            placeholder="Filter…"
            onChange={(e) => setFilter(e.target.value)}
            disabled={searching}
            style={{
              background: '#23272e',
              color: '#fff',
              border: '1px solid #353a42',
              padding: '4px 6px',
              fontSize: 13,
              minWidth: 140,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Recursive search"
            style={{
              background: '#23272e',
              color: '#fff',
              border: '1px solid #353a42',
              padding: '4px 6px',
              fontSize: 13,
              minWidth: 160,
            }}
          />
          {!searching && (
            <button
              onClick={startRecursiveSearch}
              disabled={searchInProgress || !searchQuery.trim()}
              style={{
                padding: '4px 10px',
                background: '#2d7ef7',
                border: '1px solid #1f5bb8',
                color: '#fff',
                fontSize: 12,
                cursor: searchInProgress ? 'not-allowed' : 'pointer',
              }}
            >
              {searchInProgress ? 'Searching…' : 'Search'}
            </button>
          )}
          {searching && (
            <button
              onClick={clearSearch}
              style={{
                padding: '4px 10px',
                background: '#444c56',
                border: '1px solid #353a42',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Exit Search
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={goUp}
            disabled={path === '/' || loading}
            style={{
              padding: '4px 10px',
              background: '#30363d',
              border: '1px solid #353a42',
              color: '#fff',
              cursor: path === '/' || loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            Up
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '4px 10px',
              background: '#238636',
              border: '1px solid #2ea043',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Body */}
      {error && (
        <div style={{ padding: 12, color: '#f85149' }}>Error: {error}</div>
      )}
      {!error && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* Listing area */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {searchError && searching && (
              <div style={{ color: '#f85149', marginBottom: 8 }}>
                {searchError}
              </div>
            )}
            {loading && !searching && activeListing.length === 0 && (
              <div style={{ color: '#888' }}>Loading…</div>
            )}
            {!loading && activeListing.length === 0 && (
              <div style={{ color: '#888' }}>
                {searching ? 'No matches.' : 'No entries.'}
              </div>
            )}
            {activeListing.length > 0 && (
              // ...existing code replaced: make only tbody scrollable...
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed',
                  }}
                >
                  <colgroup>
                    <col />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '160px' }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderBottom: '1px solid #353a42',
                          background: '#161b22',
                        }}
                      >
                        <span
                          style={{ display: 'inline-block', width: 20 }}
                        ></span>
                        Name
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderBottom: '1px solid #353a42',
                          background: '#161b22',
                        }}
                      >
                        Type
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderBottom: '1px solid #353a42',
                          background: '#161b22',
                        }}
                      >
                        Size
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderBottom: '1px solid #353a42',
                          background: '#161b22',
                        }}
                      >
                        Created
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderBottom: '1px solid #353a42',
                          background: '#161b22',
                        }}
                      >
                        Path
                      </th>
                    </tr>
                  </thead>
                </table>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                    }}
                  >
                    <colgroup>
                      <col />
                      <col style={{ width: '90px' }} />
                      <col style={{ width: '90px' }} />
                      <col style={{ width: '160px' }} />
                      <col />
                    </colgroup>
                    <tbody>
                      {activeListing.map((e) => {
                        const name = e.name || e.Name;
                        const isDir = !!(e.isDir || e.IsDir);
                        const fullPath = e.path || e.Path;
                        const mode =
                          e.mode || e.Mode || (isDir ? 'dir' : 'file');
                        const size = Number(e.size ?? e.Size);
                        return (
                          <tr
                            key={fullPath + (searching ? '|search' : '')}
                            onClick={() => handleRowClick(isDir, fullPath)}
                            style={{
                              cursor: 'pointer',
                              transition: 'background 0.12s',
                              background:
                                previewPath === fullPath
                                  ? 'rgba(56,139,253,0.12)'
                                  : 'transparent',
                            }}
                            onMouseEnter={(ev) =>
                              (ev.currentTarget.style.background =
                                previewPath === fullPath
                                  ? 'rgba(56,139,253,0.12)'
                                  : '#1a2027')
                            }
                            onMouseLeave={(ev) =>
                              (ev.currentTarget.style.background =
                                previewPath === fullPath
                                  ? 'rgba(56,139,253,0.12)'
                                  : 'transparent')
                            }
                          >
                            <td
                              style={{
                                textAlign: 'left',
                                padding: '6px 8px',
                                borderBottom: '1px solid #353a42',
                                color: '#e0e0e0',
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 20,
                                  textAlign: 'center',
                                }}
                              >
                                {isDir
                                  ? '📁'
                                  : mode === 'symlink'
                                    ? '🔗'
                                    : '📄'}
                              </span>
                              <span style={{ marginLeft: 4 }}>{name}</span>
                            </td>
                            <td
                              style={{
                                textAlign: 'left',
                                padding: '6px 8px',
                                borderBottom: '1px solid #353a42',
                                color: isDir ? '#4aa3ff' : '#aaa',
                                textTransform: 'capitalize',
                              }}
                            >
                              {mode}
                            </td>
                            <td
                              style={{
                                textAlign: 'left',
                                padding: '6px 8px',
                                borderBottom: '1px solid #353a42',
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: '#bbb',
                              }}
                            >
                              {isDir ? '-' : humanSize(size)}
                            </td>
                            <td
                              style={{
                                textAlign: 'left',
                                padding: '6px 8px',
                                borderBottom: '1px solid #353a42',
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: '#bbb',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatCreated(Number(e.created ?? e.Created))}
                            </td>
                            <td
                              style={{
                                textAlign: 'left',
                                padding: '6px 8px',
                                borderBottom: '1px solid #353a42',
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: '#bbb',
                              }}
                            >
                              {fullPath}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sliding Preview Panel absolute full height */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: previewWidth || 0 ? previewWidth : '75%',
              minWidth: MIN_PREVIEW_WIDTH,
              maxWidth: getDynamicMaxWidth(),
              background: '#0d1117',
              borderLeft: '1px solid #353a42',
              boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              transform: previewPath ? 'translateX(0)' : 'translateX(100%)',
              transition: resizing ? 'none' : 'transform 0.25s ease-out',
              willChange: 'transform',
            }}
          >
            {/* Resize handle */}
            {previewPath && (
              <div
                onMouseDown={startResizing}
                title="Drag to resize"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: previewPath ? 'col-resize' : 'default',
                  background: resizing ? '#30363d' : 'transparent',
                  zIndex: 5,
                  transform: 'translateX(-3px)',
                }}
              />
            )}
            {previewPath && (
              <>
                <div
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #353a42',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <strong
                    style={{
                      flex: 1,
                      color: '#fff',
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {previewPath.split('/').filter(Boolean).slice(-1)[0]}
                  </strong>
                  {previewLoading && (
                    <span style={{ color: '#888', fontSize: 12 }}>
                      Loading…
                    </span>
                  )}
                  {!previewLoading && previewData && previewData.truncated && (
                    <span
                      style={{ color: '#d29922', fontSize: 11 }}
                      title="Preview truncated"
                    >
                      TRUNCATED
                    </span>
                  )}
                  {/* Copy button (only for text, enabled when previewData present and not binary) */}
                  <button
                    onClick={copyPreview}
                    disabled={
                      previewLoading || !previewData || previewData.isBinary
                    }
                    style={{
                      padding: '4px 8px',
                      background:
                        copyState === 'copied' ? '#1f6feb' : '#30363d',
                      border: '1px solid #353a42',
                      color: '#fff',
                      fontSize: 12,
                      cursor:
                        previewLoading || !previewData || previewData.isBinary
                          ? 'not-allowed'
                          : 'pointer',
                      position: 'relative',
                    }}
                    title={
                      previewData?.isBinary
                        ? 'Binary data cannot be copied here'
                        : 'Copy file contents'
                    }
                  >
                    {copyState === 'copied' ? 'Copied' : 'Copy'}
                  </button>
                  {copyState === 'error' && copyError && (
                    <span
                      style={{ color: '#f85149', fontSize: 11 }}
                      title={copyError}
                    >
                      Copy failed
                    </span>
                  )}
                  <button
                    onClick={downloadFile}
                    disabled={previewLoading}
                    style={{
                      padding: '4px 8px',
                      background: '#238636',
                      border: '1px solid #2ea043',
                      color: '#fff',
                      fontSize: 12,
                      cursor: previewLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Download
                  </button>
                  <button
                    onClick={closePreview}
                    style={{
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid #353a42',
                      color: '#fff',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}
                >
                  {/* Status / Messages / Editor */}
                  {previewError && (
                    <div
                      style={{
                        padding: 12,
                        color: '#f85149',
                        fontSize: 12,
                        overflow: 'auto',
                      }}
                    >
                      {previewError}
                    </div>
                  )}
                  {!previewError && previewLoading && (
                    <div style={{ padding: 12, color: '#888', fontSize: 12 }}>
                      Loading…
                    </div>
                  )}
                  {!previewLoading &&
                    !previewError &&
                    previewData &&
                    previewData.isBinary && (
                      <div
                        style={{
                          padding: 12,
                          color: '#bbb',
                          fontSize: 12,
                          overflow: 'auto',
                        }}
                      >
                        Binary file preview not shown. Download to view.{' '}
                        {previewData.truncated &&
                          '(Truncated preview size)'}{' '}
                      </div>
                    )}
                  {!previewLoading &&
                    !previewError &&
                    previewData &&
                    !previewData.isBinary && (
                      <div
                        ref={previewEditorParentRef}
                        style={{ flex: 1, overflow: 'hidden' }}
                      />
                    )}
                  {!previewLoading && !previewError && !previewData && (
                    <div style={{ padding: 12, color: '#888', fontSize: 12 }}>
                      No data.
                    </div>
                  )}
                </div>
                {previewData && (
                  <div
                    style={{
                      padding: '6px 10px',
                      borderTop: '1px solid #353a42',
                      fontSize: 11,
                      color: '#888',
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Size: {previewData.size || previewData.Size || 0} bytes
                    </span>
                    <span>
                      Status:{' '}
                      {previewData.truncated ? 'Truncated preview' : 'Complete'}
                    </span>
                    <span>
                      Type: {previewData.isBinary ? 'Binary' : 'Text'}
                    </span>
                    <span style={{ marginLeft: 'auto' }}>
                      Width: {previewWidth ? Math.round(previewWidth) : ''}px
                    </span>
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
