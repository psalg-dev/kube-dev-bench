import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TextViewerTab from '../../../layout/bottompanel/TextViewerTab.jsx';
import TextEditorTab from '../../../layout/bottompanel/TextEditorTab.jsx';
import { DownloadFromSwarmVolume, GetSwarmVolumeFileContent, IsSwarmVolumeReadOnly, ListSwarmVolumeFiles, UploadToSwarmVolume } from '../../swarmApi.js';
import { showError, showSuccess } from '../../../notification.js';
import { CreateSwarmVolumeDirectory, DeleteSwarmVolumeFile, WriteSwarmVolumeFile } from '../../swarmApi.js';

const DIR_CACHE_TTL_MS = 2000;
const DIR_PAGE_SIZE = 200;

export default function VolumeFilesTab({ volumeName }) {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [visibleCount, setVisibleCount] = useState(DIR_PAGE_SIZE);
  const dirCacheRef = useRef(new Map()); // key -> { ts, entries }

  const [readOnly, setReadOnly] = useState(null); // null = unknown

  const [filePath, setFilePath] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [fileMeta, setFileMeta] = useState(null); // { size, truncated, isBinary }
  const [fileText, setFileText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const ensureNotEditingOrConfirmDiscard = () => {
    if (!isEditing) return true;
    if ((editContent || '') === (fileText || '')) return true;
    return window.confirm('Discard your unsaved changes?');
  };

  const sanitizeName = (name) => String(name || '').trim().replace(/^\/+/, '').replace(/\/+$/g, '');
  const joinPath = (dirPath, name) => {
    const safeName = sanitizeName(name);
    if (!safeName) return dirPath || '/';
    if (!dirPath || dirPath === '/') return `/${safeName}`;
    return `${dirPath.replace(/\/+$/g, '')}/${safeName}`;
  };

  const humanSize = (n) => {
    if (n == null || n === '-') return '-';
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
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

  const cacheKey = (vol, p) => `${vol || ''}::${p || ''}`;
  const setDirCache = (vol, p, list) => {
    dirCacheRef.current.set(cacheKey(vol, p), { ts: Date.now(), entries: list });
  };
  const getDirCache = (vol, p) => {
    const hit = dirCacheRef.current.get(cacheKey(vol, p));
    if (!hit) return null;
    if (Date.now() - hit.ts > DIR_CACHE_TTL_MS) return null;
    return hit.entries;
  };
  const invalidateDirCache = (vol, p) => {
    dirCacheRef.current.delete(cacheKey(vol, p));
  };

  const loadDir = useCallback(async (targetPath) => {
    if (!volumeName) return;
    setLoading(true);
    setError(null);
    setEntries([]);
    setVisibleCount(DIR_PAGE_SIZE);
    setFilePath(null);
    setFileError(null);
    setFileMeta(null);
    setFileText('');
    setIsEditing(false);
    try {
      const cached = getDirCache(volumeName, targetPath);
      if (cached) {
        setEntries(Array.isArray(cached) ? cached : []);
        setPath(targetPath);
        return;
      }

      const list = await ListSwarmVolumeFiles(volumeName, targetPath);
      const normalized = Array.isArray(list) ? list : [];
      setEntries(normalized);
      setPath(targetPath);
      setDirCache(volumeName, targetPath, normalized);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [volumeName]);

  const refreshDirEntries = useCallback(async () => {
    if (!volumeName) return;
    try {
      const list = await ListSwarmVolumeFiles(volumeName, path);
      const normalized = Array.isArray(list) ? list : [];
      setEntries(normalized);
      setDirCache(volumeName, path, normalized);
      setVisibleCount(DIR_PAGE_SIZE);
    } catch (e) {
      // Keep UI usable even if refresh fails
      setError(e?.message || String(e));
    }
  }, [path, volumeName]);

  useEffect(() => {
    loadDir('/');
  }, [loadDir]);

  useEffect(() => {
    let active = true;
    const loadRO = async () => {
      if (!volumeName) return;
      try {
        const ro = await IsSwarmVolumeReadOnly(volumeName);
        if (active) setReadOnly(!!ro);
      } catch (e) {
        if (active) setReadOnly(null);
      }
    };
    loadRO();
    return () => { active = false; };
  }, [volumeName]);

  const breadcrumbs = useMemo(() => (path === '/' ? [''] : path.split('/').filter(Boolean)), [path]);

  const handleCrumbClick = (idx) => {
    if (!ensureNotEditingOrConfirmDiscard()) return;
    if (idx === -1) {
      loadDir('/');
      return;
    }
    const newPath = `/${breadcrumbs.slice(0, idx + 1).join('/')}`;
    loadDir(newPath === '' ? '/' : newPath);
  };

  const openEntry = (entry) => {
    if (!ensureNotEditingOrConfirmDiscard()) return;
    if (entry?.isDir) {
      loadDir(entry.path);
    } else {
      fetchFile(entry.path);
    }
  };

  const startEdit = () => {
    if (readOnly === true) return;
    if (!filePath) return;
    if (fileMeta?.isBinary) return;
    setEditContent(fileText || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!isEditing) return;
    if (!ensureNotEditingOrConfirmDiscard()) return;
    setIsEditing(false);
    setEditContent('');
  };

  const saveEdit = async () => {
    if (readOnly === true) return;
    if (!filePath) return;
    if (fileMeta?.isBinary) return;
    try {
      setIsSaving(true);
      await WriteSwarmVolumeFile(volumeName, filePath, editContent || '', 'utf-8');
      setFileText(editContent || '');
      setIsEditing(false);
      setEditContent('');
      showSuccess('Saved file');
      invalidateDirCache(volumeName, path);
      await refreshDirEntries();
    } catch (e) {
      showError(`Save failed: ${e?.message || String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const createFolder = async () => {
    if (readOnly === true) return;
    if (!ensureNotEditingOrConfirmDiscard()) return;
    const name = window.prompt('New folder name:');
    const safe = sanitizeName(name);
    if (!safe) return;
    try {
      await CreateSwarmVolumeDirectory(volumeName, joinPath(path, safe));
      showSuccess('Folder created');
      invalidateDirCache(volumeName, path);
      await refreshDirEntries();
    } catch (e) {
      showError(`Create folder failed: ${e?.message || String(e)}`);
    }
  };

  const createFile = async () => {
    if (readOnly === true) return;
    if (!ensureNotEditingOrConfirmDiscard()) return;
    const name = window.prompt('New file name:');
    const safe = sanitizeName(name);
    if (!safe) return;
    try {
      await WriteSwarmVolumeFile(volumeName, joinPath(path, safe), '', 'utf-8');
      showSuccess('File created');
      invalidateDirCache(volumeName, path);
      await refreshDirEntries();
    } catch (e) {
      showError(`Create file failed: ${e?.message || String(e)}`);
    }
  };

  const deleteEntry = async (entry) => {
    if (readOnly === true) return;
    if (!entry?.path) return;
    if (!ensureNotEditingOrConfirmDiscard()) return;

    const label = entry.isDir ? 'folder' : 'file';
    const ok = window.confirm(
      entry.isDir ? `Delete folder ${entry.path} (recursive)?` : `Delete file ${entry.path}?`
    );
    if (!ok) return;

    try {
      await DeleteSwarmVolumeFile(volumeName, entry.path, !!entry.isDir);
      showSuccess(`${label} deleted`);
      if (filePath === entry.path) {
        setFilePath(null);
        setFileError(null);
        setFileMeta(null);
        setFileText('');
        setIsEditing(false);
        setEditContent('');
      }
      invalidateDirCache(volumeName, path);
      await refreshDirEntries();
    } catch (e) {
      showError(`Delete failed: ${e?.message || String(e)}`);
    }
  };

  const fetchFile = async (targetFilePath) => {
    if (!volumeName) return;
    setFileLoading(true);
    setFileError(null);
    setFilePath(targetFilePath);
    setFileMeta(null);
    setFileText('');
    setIsEditing(false);

    try {
      const res = await GetSwarmVolumeFileContent(volumeName, targetFilePath, 262144); // 256 KiB cap
      const isBinary = !!res?.isBinary;
      let text = '';
      if (!isBinary) {
        try {
          text = atob(res?.base64 || '');
        } catch (e) {
          text = '[decode error]';
        }
      }
      setFileMeta({
        size: res?.size,
        truncated: !!res?.truncated,
        isBinary,
      });
      setFileText(text);
    } catch (e) {
      setFileError(e?.message || String(e));
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!volumeName || !filePath) return;
    try {
      const dest = await DownloadFromSwarmVolume(volumeName, filePath);
      if (!dest) return; // user cancelled
      showSuccess('Downloaded file');
    } catch (e) {
      showError(`Download failed: ${e?.message || String(e)}`);
    }
  };

  const downloadPath = async (targetPath) => {
    if (!volumeName || !targetPath) return;
    try {
      const dest = await DownloadFromSwarmVolume(volumeName, targetPath);
      if (!dest) return;
      showSuccess('Downloaded file');
    } catch (e) {
      showError(`Download failed: ${e?.message || String(e)}`);
    }
  };

  const handleUpload = async () => {
    if (!volumeName) return;
    const destDir = path === '/' ? '/' : (path.endsWith('/') ? path : `${path}/`);
    try {
      const uploaded = await UploadToSwarmVolume(volumeName, destDir);
      if (!uploaded) return; // user cancelled
      showSuccess(`Uploaded to ${uploaded}`);
      invalidateDirCache(volumeName, path);
      loadDir(path);
    } catch (e) {
      showError(`Upload failed: ${e?.message || String(e)}`);
    }
  };

  const visibleEntries = useMemo(() => {
    return entries.slice(0, visibleCount);
  }, [entries, visibleCount]);

  const hasMoreEntries = entries.length > visibleCount;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '8px 12px',
        background: 'var(--gh-bg-alt, #161b22)',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <span style={{ fontWeight: 600 }}>Files</span>
        <button
          onClick={handleUpload}
          disabled={readOnly === true}
          style={{
            padding: '6px 10px',
            background: 'rgba(56,139,253,0.15)',
            color: '#58a6ff',
            border: '1px solid #30363d',
            cursor: readOnly === true ? 'default' : 'pointer',
            opacity: readOnly === true ? 0.6 : 1,
          }}
        >
          Upload
        </button>
        <button
          onClick={createFile}
          disabled={readOnly === true}
          style={{
            padding: '6px 10px',
            background: 'rgba(56,139,253,0.15)',
            color: '#58a6ff',
            border: '1px solid #30363d',
            cursor: readOnly === true ? 'default' : 'pointer',
            opacity: readOnly === true ? 0.6 : 1,
          }}
          title={readOnly === true ? 'Volume is read-only' : 'Create a new empty file in this directory'}
        >
          New File
        </button>
        <button
          onClick={createFolder}
          disabled={readOnly === true}
          style={{
            padding: '6px 10px',
            background: 'rgba(56,139,253,0.15)',
            color: '#58a6ff',
            border: '1px solid #30363d',
            cursor: readOnly === true ? 'default' : 'pointer',
            opacity: readOnly === true ? 0.6 : 1,
          }}
          title={readOnly === true ? 'Volume is read-only' : 'Create a new folder in this directory'}
        >
          New Folder
        </button>
        <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => handleCrumbClick(-1)}>root</span>
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              <span style={{ margin: '0 4px' }}>/</span>
              <span style={{ cursor: 'pointer' }} onClick={() => handleCrumbClick(idx)}>{b}</span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gh-text-muted, #8b949e)' }}>
          Volume: <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>{volumeName}</span>
          {readOnly === true ? <span style={{ marginLeft: 10, color: '#f0883e' }}>read-only</span> : null}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: '50%', minWidth: 300, borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>
          {loading && (<div style={{ padding: 12, fontSize: 13, color: 'var(--gh-text-muted, #8b949e)' }}>Loading directory...</div>)}
          {error && (<div style={{ padding: 12, fontSize: 13, color: '#f85149' }}>Error: {error}</div>)}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--gh-text-muted, #8b949e)' }}>Empty directory or not accessible.</div>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: 'var(--gh-bg-alt, #161b22)' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Perms</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Size</th>
                  <th style={thStyle}>Modified</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 150 }}> </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e) => (
                  <tr key={e.path} onClick={() => openEntry(e)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '4px 8px', color: e.isDir ? 'var(--gh-accent, #58a6ff)' : 'var(--gh-text, #c9d1d9)' }}>
                      {e.isDir ? '📁 ' : '📄 '}
                      {e.name}
                      {e.isSymlink && e.linkTarget ? <span style={{ color: 'var(--gh-text-muted, #8b949e)' }}> ➜ {e.linkTarget}</span> : null}
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--gh-text-muted, #8b949e)', whiteSpace: 'nowrap' }}>{e.mode || ''}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--gh-text-muted, #8b949e)' }}>{e.isDir ? '-' : humanSize(e.size)}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--gh-text-muted, #8b949e)' }}>{e.modified ? String(e.modified).replace('T', ' ') : ''}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      {!e.isDir ? (
                        <button
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            downloadPath(e.path);
                          }}
                          style={{
                            padding: '2px 6px',
                            background: 'rgba(56,139,253,0.15)',
                            color: '#58a6ff',
                            border: '1px solid #30363d',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Download
                        </button>
                      ) : null}

                      {readOnly !== true ? (
                        <button
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            deleteEntry(e);
                          }}
                          style={{
                            padding: '2px 6px',
                            marginLeft: 8,
                            background: 'rgba(248,81,73,0.12)',
                            color: '#f85149',
                            border: '1px solid #30363d',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}

                {hasMoreEntries ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--gh-text-muted, #8b949e)' }}>
                      <button
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setVisibleCount((c) => Math.min(entries.length, c + DIR_PAGE_SIZE));
                        }}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(56,139,253,0.15)',
                          color: '#58a6ff',
                          border: '1px solid #30363d',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Show more ({entries.length - visibleCount} remaining)
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!filePath && !fileLoading && !fileError && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted, #8b949e)' }}>
              Select a file to preview (text up to 256 KiB). Binary files are not previewed.
            </div>
          )}

          {fileError && (
            <div style={{ padding: 16, fontSize: 13, color: '#f85149' }}>Error: {fileError}</div>
          )}

          {filePath && fileMeta?.isBinary && !fileLoading && !fileError && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--gh-text-muted, #8b949e)' }}>
              {filePath} is a binary file ({humanSize(fileMeta?.size)}). Preview disabled.
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(56,139,253,0.15)',
                    color: '#58a6ff',
                    border: '1px solid #30363d',
                    cursor: 'pointer',
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {filePath && !fileMeta?.isBinary && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid #30363d',
                fontSize: 12,
                color: 'var(--gh-text-muted, #8b949e)',
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <span style={{ color: 'var(--gh-text, #c9d1d9)' }}>{filePath}</span>
                {fileMeta?.truncated ? <span style={{ color: '#f0883e' }}>truncated</span> : null}
                {fileMeta?.size != null ? <span>size {humanSize(fileMeta.size)}</span> : null}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {readOnly !== true && !isEditing ? (
                    <button
                      onClick={startEdit}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(56,139,253,0.15)',
                        color: '#58a6ff',
                        border: '1px solid #30363d',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Edit
                    </button>
                  ) : null}

                  {readOnly !== true && isEditing ? (
                    <button
                      onClick={saveEdit}
                      disabled={isSaving}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(56,139,253,0.15)',
                        color: '#58a6ff',
                        border: '1px solid #30363d',
                        cursor: isSaving ? 'default' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                        fontSize: 12,
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  ) : null}

                  {readOnly !== true && isEditing ? (
                    <button
                      onClick={cancelEdit}
                      disabled={isSaving}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(56,139,253,0.15)',
                        color: '#58a6ff',
                        border: '1px solid #30363d',
                        cursor: isSaving ? 'default' : 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}

                  <button
                    onClick={handleDownload}
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(56,139,253,0.15)',
                      color: '#58a6ff',
                      border: '1px solid #30363d',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Download
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {isEditing ? (
                  <TextEditorTab
                    content={editContent}
                    filename={filePath}
                    onChange={setEditContent}
                    disabled={readOnly === true || isSaving}
                    loading={fileLoading}
                    error={fileError}
                    loadingLabel="Loading file..."
                  />
                ) : (
                  <TextViewerTab
                    content={fileText}
                    filename={filePath}
                    loading={fileLoading}
                    error={fileError}
                    loadingLabel="Loading file..."
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '6px 8px',
  color: 'var(--gh-text-muted, #8b949e)',
  fontWeight: 600,
  borderBottom: '1px solid #30363d',
};
