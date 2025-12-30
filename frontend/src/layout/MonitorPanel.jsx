import React, { useState, useRef, useEffect } from 'react';

export function MonitorPanel({ monitorInfo, open, onClose }) {
  const [activeTab, setActiveTab] = useState('errors');
  const [height, setHeight] = useState(() => {
    try { return Number(localStorage.getItem('monitorpanel.height')) || 400; } catch { return 400; }
  });
  const resizeRef = useRef({ startY: 0, startH: 0, resizing: false });

  useEffect(() => {
    try { localStorage.setItem('monitorpanel.height', String(height)); } catch {}
  }, [height]);

  // Smart tab pre-selection when panel opens
  useEffect(() => {
    if (open) {
      // If errors exist, show errors tab; otherwise show warnings tab
      if (monitorInfo.errorCount > 0) {
        setActiveTab('errors');
      } else if (monitorInfo.warningCount > 0) {
        setActiveTab('warnings');
      }
    }
  }, [open, monitorInfo.errorCount, monitorInfo.warningCount]);

  const handleIssueClick = (issue) => {
    // Emit custom event to navigate to the resource
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        resource: issue.resource,
        name: issue.name,
        namespace: issue.namespace,
      }
    });
    window.dispatchEvent(event);
    onClose();
  };

  if (!open) return null;

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    resizeRef.current = { startY, startH: height, resizing: true };

    const onMove = (ev) => {
      if (!resizeRef.current.resizing) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dy = resizeRef.current.startY - ev.clientY; // up increases height
      const next = Math.max(200, Math.min(resizeRef.current.startH + dy, Math.floor(window.innerHeight * 0.9)));
      setHeight(next);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };

    const onUp = (ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      resizeRef.current.resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const issues = activeTab === 'errors' ? (monitorInfo.errors || []) : (monitorInfo.warnings || []);

  return (
    <div
      id="monitor-panel"
      className="bottom-panel"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        background: 'var(--gh-bg, #0d1117)',
        color: 'var(--gh-text, #c9d1d9)',
        borderTop: '1px solid var(--gh-border, #30363d)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        transition: resizeRef.current.resizing ? 'none' : 'height 0.12s ease-out',
        animation: 'slideUpPanel 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes slideUpPanel {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Drag handle */}
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        data-resizing="true"
        style={{
          height: 6,
          cursor: 'ns-resize',
          background: 'transparent',
          borderTop: '2px solid var(--gh-border, #30363d)',
          borderBottom: '1px solid var(--gh-border, #30363d)'
        }}
      />

      {/* Tabs header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        background: 'var(--gh-bg-sidebar, #161b22)',
        borderBottom: '1px solid var(--gh-border, #30363d)'
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            id="monitor-tab-errors"
            onClick={() => setActiveTab('errors')}
            style={{
              border: '1px solid var(--gh-border, #30363d)',
              borderBottom: activeTab === 'errors' ? '2px solid var(--gh-accent, #238636)' : '1px solid var(--gh-border, #30363d)',
              background: activeTab === 'errors' ? 'rgba(56, 139, 253, 0.08)' : 'transparent',
              color: 'var(--gh-text, #c9d1d9)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 0,
              fontSize: 13
            }}
          >
            Errors ({monitorInfo.errorCount || 0})
          </button>
          <button
            id="monitor-tab-warnings"
            onClick={() => setActiveTab('warnings')}
            style={{
              border: '1px solid var(--gh-border, #30363d)',
              borderBottom: activeTab === 'warnings' ? '2px solid var(--gh-accent, #238636)' : '1px solid var(--gh-border, #30363d)',
              background: activeTab === 'warnings' ? 'rgba(56, 139, 253, 0.08)' : 'transparent',
              color: 'var(--gh-text, #c9d1d9)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 0,
              fontSize: 13
            }}
          >
            Warnings ({monitorInfo.warningCount || 0})
          </button>
        </div>
        <button
          onClick={onClose}
          title="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--gh-text, #c9d1d9)',
            cursor: 'pointer',
            fontSize: 18
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '16px'
      }}>
        {issues.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            color: 'var(--gh-text-secondary, #8b949e)',
          }}>
            No {activeTab} found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {issues.map((issue, index) => {
              // Build resource path breadcrumb
              const pathParts = [];
              if (issue.ownerKind && issue.ownerName) {
                pathParts.push(`${issue.ownerKind}/${issue.ownerName}`);
              }
              pathParts.push(`${issue.resource}/${issue.name}`);
              if (issue.containerName) {
                pathParts.push(`${issue.containerName}`);
              }
              const resourcePath = pathParts.join(' → ');

              return (
                <div
                  key={index}
                  className="monitor-issue-item"
                  onClick={() => handleIssueClick(issue)}
                  style={{
                    background: 'var(--gh-bg-secondary, #161b22)',
                    border: '1px solid var(--gh-border, #30363d)',
                    borderLeft: `3px solid ${issue.type === 'error' ? '#d73a49' : '#dbab09'}`,
                    borderRadius: '6px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--gh-bg-tertiary, #1c2128)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--gh-bg-secondary, #161b22)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Header with reason and metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                    <span
                      style={{
                        background: issue.type === 'error' ? '#d73a49' : '#dbab09',
                        color: '#fff',
                        borderRadius: '12px',
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {issue.reason}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          background: 'var(--gh-bg-tertiary, #1c2128)',
                          color: 'var(--gh-text-muted, #8b949e)',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}
                      >
                        {issue.namespace}
                      </span>
                      {issue.age && (
                        <span
                          style={{
                            color: 'var(--gh-text-muted, #8b949e)',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}
                        >
                          {issue.age}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Resource path breadcrumb */}
                  <div style={{
                    marginBottom: '10px',
                    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
                    fontSize: '12px',
                    color: 'var(--gh-text-primary, #c9d1d9)',
                    fontWeight: '500',
                    padding: '6px 8px',
                    background: 'var(--gh-bg-primary, #0d1117)',
                    borderRadius: '4px',
                    border: '1px solid var(--gh-border, #30363d)'
                  }}>
                    {resourcePath}
                  </div>

                  {/* Metadata row */}
                  {(issue.podPhase || issue.nodeName || issue.restartCount > 0) && (
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      marginBottom: '10px',
                      flexWrap: 'wrap'
                    }}>
                      {issue.podPhase && (
                        <span style={{ fontSize: '11px', color: 'var(--gh-text-muted, #8b949e)' }}>
                          <span style={{ fontWeight: '600' }}>Phase:</span> {issue.podPhase}
                        </span>
                      )}
                      {issue.nodeName && (
                        <span style={{ fontSize: '11px', color: 'var(--gh-text-muted, #8b949e)' }}>
                          <span style={{ fontWeight: '600' }}>Node:</span> {issue.nodeName}
                        </span>
                      )}
                      {issue.restartCount > 0 && (
                        <span style={{
                          fontSize: '11px',
                          color: issue.restartCount > 5 ? '#f85149' : 'var(--gh-text-muted, #8b949e)',
                          fontWeight: issue.restartCount > 5 ? '600' : '400'
                        }}>
                          <span style={{ fontWeight: '600' }}>Restarts:</span> {issue.restartCount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message */}
                  {issue.message && (
                    <div style={{
                      color: 'var(--gh-text-secondary, #8b949e)',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>
                      {issue.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonitorPanel;
