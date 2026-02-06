import { useMemo, useState } from 'react';
import HolmesResponseRenderer from '../holmes/HolmesResponseRenderer';
import './MonitorIssueCard.css';

type MonitorIssue = {
  issueID?: string;
  type?: string;
  reason?: string;
  namespace?: string;
  age?: string;
  ownerKind?: string;
  ownerName?: string;
  resource?: string;
  name?: string;
  containerName?: string;
  podPhase?: string;
  nodeName?: string;
  restartCount?: number;
  message?: string;
  holmesAnalysis?: string;
  holmesAnalyzedAt?: string;
  holmesAnalyzed?: boolean;
};

type MonitorIssueCardProps = {
  issue: MonitorIssue;
  onNavigate: (issue: MonitorIssue) => void;
  onAnalyze: (issue: MonitorIssue) => void;
  onDismiss: (issue: MonitorIssue) => void;
  analyzing?: boolean;
  dismissing?: boolean;
};

export function MonitorIssueCard({
  issue,
  onNavigate,
  onAnalyze,
  onDismiss,
  analyzing,
  dismissing,
}: MonitorIssueCardProps) {
  const [expanded, setExpanded] = useState(false);

  const resourcePath = useMemo(() => {
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

  const handleAnalyze = (event: React.MouseEvent) => {
    event.stopPropagation();
    onAnalyze(issue);
  };

  const handleDismiss = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDismiss(issue);
  };

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
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
          {issue.namespace && <span className="monitor-issue-namespace">{issue.namespace}</span>}
          {issue.age && <span className="monitor-issue-age">{issue.age}</span>}
        </div>
      </div>

      <div className="monitor-issue-path">{resourcePath}</div>

      {(issue.podPhase || issue.nodeName || (issue.restartCount || 0) > 0) && (
        <div className="monitor-issue-details">
          {issue.podPhase && (
            <span>
              <strong>Phase:</strong> {issue.podPhase}
            </span>
          )}
          {issue.nodeName && (
            <span>
              <strong>Node:</strong> {issue.nodeName}
            </span>
          )}
          {(issue.restartCount || 0) > 0 && (
            <span className={(issue.restartCount || 0) > 5 ? 'monitor-issue-restarts hot' : 'monitor-issue-restarts'}>
              <strong>Restarts:</strong> {issue.restartCount}
            </span>
          )}
        </div>
      )}

      {issue.message && <div className="monitor-issue-message">{issue.message}</div>}

      <div className="monitor-issue-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="monitor-issue-btn" onClick={handleAnalyze} disabled={analyzing}>
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
          <button type="button" className="monitor-issue-btn ghost" onClick={handleToggle}>
            {expanded ? 'Hide Analysis' : 'Show Analysis'}
          </button>
        )}
        {issue.holmesAnalysis && <span className="monitor-issue-analysis-meta">{analyzedAtLabel}</span>}
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
