import { useState } from 'react';

type MonitorIssue = {
  resource?: string;
  name?: string;
  namespace?: string;
  ownerKind?: string;
  ownerName?: string;
  containerName?: string;
  type?: 'error' | 'warning' | string;
  reason?: string;
  age?: string;
  podPhase?: string;
  nodeName?: string;
  restartCount?: number;
  message?: string;
};

type MonitorInfo = {
  errorCount: number;
  warningCount: number;
  errors?: MonitorIssue[];
  warnings?: MonitorIssue[];
};

type MonitorModalProps = {
  monitorInfo: MonitorInfo;
  onClose: () => void;
};

export function MonitorModal({ monitorInfo, onClose }: MonitorModalProps) {
  const [activeTab, setActiveTab] = useState('errors');

  const issues = activeTab === 'errors' ? monitorInfo.errors || [] : monitorInfo.warnings || [];

  const handleIssueClick = (issue: MonitorIssue) => {
    // Emit custom event to navigate to the resource
    const event = new CustomEvent('navigate-to-resource', {
      detail: {
        resource: issue.resource,
        name: issue.name,
        namespace: issue.namespace,
      },
    });
    window.dispatchEvent(event);
    onClose();
  };

  return (
    <div
      id="monitor-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        id="monitor-modal"
        style={{
          background: 'var(--gh-bg-primary, #0d1117)',
          border: '1px solid var(--gh-border, #30363d)',
          borderRadius: '6px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--gh-border, #30363d)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Cluster Monitor</h2>
          <button
            id="monitor-modal-close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--gh-text-secondary, #8b949e)',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '0 8px',
              lineHeight: '1',
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--gh-border, #30363d)',
          }}
        >
          <button
            id="monitor-tab-errors"
            onClick={() => setActiveTab('errors')}
            style={{
              background: activeTab === 'errors' ? '#d73a49' : 'transparent',
              color: activeTab === 'errors' ? '#fff' : 'var(--gh-text-secondary, #8b949e)',
              border: activeTab === 'errors' ? 'none' : '1px solid var(--gh-border, #30363d)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Errors ({monitorInfo.errorCount})
          </button>
          <button
            id="monitor-tab-warnings"
            onClick={() => setActiveTab('warnings')}
            style={{
              background: activeTab === 'warnings' ? '#dbab09' : 'transparent',
              color: activeTab === 'warnings' ? '#fff' : 'var(--gh-text-secondary, #8b949e)',
              border: activeTab === 'warnings' ? 'none' : '1px solid var(--gh-border, #30363d)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Warnings ({monitorInfo.warningCount})
          </button>
        </div>

        {/* Content */}
        <div
          id="monitor-modal-content"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
          }}
        >
          {issues.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px',
                color: 'var(--gh-text-secondary, #8b949e)',
              }}
            >
              No {activeTab} found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {issues.map((issue, index) => {
                // Build resource path breadcrumb
                const pathParts: string[] = [];
                if (issue.ownerKind && issue.ownerName) {
                  pathParts.push(`${issue.ownerKind}/${issue.ownerName}`);
                }
                if (issue.resource && issue.name) {
                  pathParts.push(`${issue.resource}/${issue.name}`);
                }
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
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = 'var(--gh-bg-tertiary, #1c2128)';
                      event.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'var(--gh-bg-secondary, #161b22)';
                      event.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Header with reason and metadata */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          background: issue.type === 'error' ? '#d73a49' : '#dbab09',
                          color: '#fff',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
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
                            fontWeight: '500',
                          }}
                        >
                          {issue.namespace}
                        </span>
                        {issue.age && (
                          <span
                            style={{
                              color: 'var(--gh-text-muted, #8b949e)',
                              fontSize: '11px',
                              fontWeight: '500',
                            }}
                          >
                            {issue.age}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resource path breadcrumb */}
                    <div
                      style={{
                        marginBottom: '10px',
                        fontFamily:
                          'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
                        fontSize: '12px',
                        color: 'var(--gh-text-primary, #c9d1d9)',
                        fontWeight: '500',
                        padding: '6px 8px',
                        background: 'var(--gh-bg-primary, #0d1117)',
                        borderRadius: '4px',
                        border: '1px solid var(--gh-border, #30363d)',
                      }}
                    >
                      {resourcePath}
                    </div>

                    {/* Metadata row */}
                    {(issue.podPhase || issue.nodeName || (issue.restartCount || 0) > 0) && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          marginBottom: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
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
                        {(issue.restartCount || 0) > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: (issue.restartCount || 0) > 5 ? '#f85149' : 'var(--gh-text-muted, #8b949e)',
                            }}
                          >
                            <span style={{ fontWeight: '600' }}>Restarts:</span> {issue.restartCount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    {issue.message && (
                      <div style={{ fontSize: '12px', color: 'var(--gh-text-secondary, #8b949e)' }}>{issue.message}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MonitorModal;
