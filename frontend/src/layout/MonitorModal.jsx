import { useState } from 'react';
import './MonitorModal.css';

export function MonitorModal({ monitorInfo, onClose }) {
  const [activeTab, setActiveTab] = useState('errors');

  const issues = activeTab === 'errors' ? (monitorInfo.errors || []) : (monitorInfo.warnings || []);

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

  return (
    <div
      id="monitor-modal-overlay"
      className="monitor-modal-overlay"
      onClick={onClose}
    >
      <div
        id="monitor-modal"
        className="monitor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="monitor-modal-header">
          <h2>Cluster Monitor</h2>
          <button
            id="monitor-modal-close"
            className="monitor-modal-close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="monitor-modal-tabs">
          <button
            id="monitor-tab-errors"
            className={`monitor-modal-tab ${activeTab === 'errors' ? 'active-errors' : ''}`}
            onClick={() => setActiveTab('errors')}
          >
            Errors ({monitorInfo.errorCount})
          </button>
          <button
            id="monitor-tab-warnings"
            className={`monitor-modal-tab ${activeTab === 'warnings' ? 'active-warnings' : ''}`}
            onClick={() => setActiveTab('warnings')}
          >
            Warnings ({monitorInfo.warningCount})
          </button>
        </div>

        {/* Content */}
        <div id="monitor-modal-content" className="monitor-modal-content">
          {issues.length === 0 ? (
            <div className="monitor-modal-empty">
              No {activeTab} found
            </div>
          ) : (
            <div className="monitor-issues-list">
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
                    className={`monitor-issue-item ${issue.type}`}
                    onClick={() => handleIssueClick(issue)}
                  >
                    {/* Header with reason and metadata */}
                    <div className="monitor-issue-header">
                      <span className={`monitor-issue-badge ${issue.type}`}>
                        {issue.reason}
                      </span>
                      <div className="monitor-issue-meta">
                        <span className="monitor-issue-namespace">
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
                    {(issue.podPhase || issue.nodeName || issue.restartCount > 0) && (
                      <div className="monitor-issue-details">
                        {issue.podPhase && (
                          <span className="monitor-issue-detail">
                            <span>Phase:</span> {issue.podPhase}
                          </span>
                        )}
                        {issue.nodeName && (
                          <span className="monitor-issue-detail">
                            <span>Node:</span> {issue.nodeName}
                          </span>
                        )}
                        {issue.restartCount > 0 && (
                          <span className={`monitor-issue-detail ${issue.restartCount > 5 ? 'critical' : ''}`}>
                            <span>Restarts:</span> {issue.restartCount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    {issue.message && (
                      <div className="monitor-issue-message">
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
    </div>
  );
}

export default MonitorModal;
