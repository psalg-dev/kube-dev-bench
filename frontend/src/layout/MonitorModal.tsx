import { useState } from 'react';
import './MonitorModal.css';

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
      className="monitor-modal-overlay"
      onClick={onClose}
    >
      <div
        id="monitor-modal"
        className="monitor-modal"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="monitor-modal__header">
          <h2 className="monitor-modal__title">Cluster Monitor</h2>
          <button
            id="monitor-modal-close"
            onClick={onClose}
            className="monitor-modal__close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="monitor-modal__tabs">
          <button
            id="monitor-tab-errors"
            onClick={() => setActiveTab('errors')}
            className={`monitor-modal__tab-button monitor-modal__tab-button--errors${activeTab === 'errors' ? ' is-active' : ''}`}
          >
            Errors ({monitorInfo.errorCount})
          </button>
          <button
            id="monitor-tab-warnings"
            onClick={() => setActiveTab('warnings')}
            className={`monitor-modal__tab-button monitor-modal__tab-button--warnings${activeTab === 'warnings' ? ' is-active' : ''}`}
          >
            Warnings ({monitorInfo.warningCount})
          </button>
        </div>

        {/* Content */}
        <div
          id="monitor-modal-content"
          className="monitor-modal__content"
        >
          {issues.length === 0 ? (
            <div className="monitor-modal__empty">
              No {activeTab} found
            </div>
          ) : (
            <div className="monitor-modal__issues">
              {issues.map((issue, index) => {
                const issueTone = issue.type === 'error' ? 'error' : 'warning';
                const restartClassName = (issue.restartCount || 0) > 5
                  ? 'monitor-issue-restarts monitor-issue-restarts--high'
                  : 'monitor-issue-restarts';

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
                    className={`monitor-issue-item monitor-issue-item--${issueTone}`}
                  >
                    {/* Header with reason and metadata */}
                    <div className="monitor-issue-header">
                      <span
                        className="monitor-issue-badge"
                      >
                        {issue.reason}
                      </span>
                      <div className="monitor-issue-meta">
                        <span
                          className="monitor-issue-namespace"
                        >
                          {issue.namespace}
                        </span>
                        {issue.age && (
                          <span className="monitor-issue-age">
                            {issue.age}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resource path breadcrumb */}
                    <div className="monitor-issue-path">
                      {resourcePath}
                    </div>

                    {/* Metadata row */}
                    {(issue.podPhase || issue.nodeName || (issue.restartCount || 0) > 0) && (
                      <div className="monitor-issue-meta-row">
                        {issue.podPhase && (
                          <span className="monitor-issue-meta-text">
                            <span className="monitor-issue-meta-label">Phase:</span> {issue.podPhase}
                          </span>
                        )}
                        {issue.nodeName && (
                          <span className="monitor-issue-meta-text">
                            <span className="monitor-issue-meta-label">Node:</span> {issue.nodeName}
                          </span>
                        )}
                        {(issue.restartCount || 0) > 0 && (
                          <span className={restartClassName}>
                            <span className="monitor-issue-meta-label">Restarts:</span> {issue.restartCount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    {issue.message && (
                      <div className="monitor-issue-message">{issue.message}</div>
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
