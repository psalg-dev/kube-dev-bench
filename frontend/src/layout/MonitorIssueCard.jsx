import React, { useMemo, useState } from 'react';
import HolmesResponseRenderer from '../holmes/HolmesResponseRenderer.jsx';
import './MonitorIssueCard.css';

export function MonitorIssueCard({ issue, onNavigate, onAnalyze, onDismiss, analyzing, dismissing }) {
  const [expanded, setExpanded] = useState(false);

  const resourcePath = useMemo(() => {
    const pathParts = [];
    if (issue.ownerKind && issue.ownerName) {
      pathParts.push(`${issue.ownerKind}/${issue.ownerName}`);
    }
    pathParts.push(`${issue.resource}/${issue.name}`);
    if (issue.containerName) {
      pathParts.push(`${issue.containerName}`);
    }
    return pathParts.join(' → ');
  }, [issue]);

  const analyzedAtLabel = useMemo(() => {
    if (!issue.holmesAnalyzedAt) return '';
    const ts = new Date(issue.holmesAnalyzedAt);
    const diffMs = Date.now() - ts.getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `Analyzed ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Analyzed ${hours}h ago`;
  }, [issue.holmesAnalyzedAt]);

  const handleAnalyze = (e) => {
    e.stopPropagation();
    onAnalyze(issue);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    onDismiss(issue);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <div
      className="monitor-issue-card"
      data-issue-id={issue.issueID}
      data-issue-type={issue.type}
      onClick={() => onNavigate(issue)}
    >
      <div className="monitor-issue-header">
        <span className={`monitor-issue-pill ${issue.type === 'error' ? 'is-error' : 'is-warning'}`}>
          {issue.reason}
        </span>
        <div className="monitor-issue-meta">
          {issue.namespace && (
            <span className="monitor-issue-namespace">{issue.namespace}</span>
          )}
          {issue.age && <span className="monitor-issue-age">{issue.age}</span>}
        </div>
      </div>

      <div className="monitor-issue-path">{resourcePath}</div>

      {(issue.podPhase || issue.nodeName || issue.restartCount > 0) && (
        <div className="monitor-issue-details">
          {issue.podPhase && (
            <span><strong>Phase:</strong> {issue.podPhase}</span>
          )}
          {issue.nodeName && (
            <span><strong>Node:</strong> {issue.nodeName}</span>
          )}
          {issue.restartCount > 0 && (
            <span className={issue.restartCount > 5 ? 'monitor-issue-restarts hot' : 'monitor-issue-restarts'}>
              <strong>Restarts:</strong> {issue.restartCount}
            </span>
          )}
        </div>
      )}

      {issue.message && (
        <div className="monitor-issue-message">{issue.message}</div>
      )}

      <div className="monitor-issue-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="monitor-issue-btn"
          onClick={handleAnalyze}
          disabled={analyzing}
        >
          {analyzing ? 'Analyzing…' : 'Analyze'}
        </button>
        <button
          type="button"
          className="monitor-issue-btn secondary"
          onClick={handleDismiss}
          disabled={dismissing}
        >
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </button>
        {issue.holmesAnalysis && (
          <button
            type="button"
            className="monitor-issue-btn ghost"
            onClick={handleToggle}
          >
            {expanded ? 'Hide Analysis' : 'Show Analysis'}
          </button>
        )}
        {issue.holmesAnalysis && (
          <span className="monitor-issue-analysis-meta">{analyzedAtLabel}</span>
        )}
      </div>

      {expanded && issue.holmesAnalysis && (
        <div className="monitor-issue-analysis">
          <HolmesResponseRenderer response={{ response: issue.holmesAnalysis }} />
        </div>
      )}
    </div>
  );
}

export default MonitorIssueCard;
