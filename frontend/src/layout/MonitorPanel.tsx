import { useEffect, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import MonitorIssueCard from './MonitorIssueCard';
import PrometheusAlertsTab from './PrometheusAlertsTab';
import {
  AnalyzeAllMonitorIssues,
  AnalyzeMonitorIssue,
  DismissMonitorIssue,
  ScanClusterHealth,
} from './monitorApi';
type MonitorIssue = {
  issueID?: string;
  type?: 'error' | 'warning' | string;
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
  dismissed?: boolean;
};

type MonitorInfo = {
  errorCount: number;
  warningCount: number;
  errors?: MonitorIssue[];
  warnings?: MonitorIssue[];
};

type MonitorPanelProps = {
  monitorInfo: MonitorInfo;
  open: boolean;
  onClose: () => void;
};

type ResizeState = {
  startY: number;
  startH: number;
  resizing: boolean;
};

export function MonitorPanel({ monitorInfo, open, onClose }: MonitorPanelProps) {
  const [activeTab, setActiveTab] = useState('errors');
  const [panelInfo, setPanelInfo] = useState<MonitorInfo>(monitorInfo);
  const [scanLoading, setScanLoading] = useState(false);
  const [analyzeAllLoading, setAnalyzeAllLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState<Record<string, boolean>>({});
  const [dismissLoading, setDismissLoading] = useState<Record<string, boolean>>({});
  const [height, setHeight] = useState(() => {
    try {
      return Number(localStorage.getItem('monitorpanel.height')) || 400;
    } catch {
      return 400;
    }
  });
  const resizeRef = useRef<ResizeState>({ startY: 0, startH: 0, resizing: false });

  useEffect(() => {
    setPanelInfo(monitorInfo);
  }, [monitorInfo]);

  useEffect(() => {
    try {
      localStorage.setItem('monitorpanel.height', String(height));
    } catch {
      // ignore
    }
  }, [height]);

  // Smart tab pre-selection when panel opens
  useEffect(() => {
    if (open) {
      // If errors exist, show errors tab; otherwise show warnings tab
      if (panelInfo.errorCount > 0) {
        setActiveTab('errors');
      } else if (panelInfo.warningCount > 0) {
        setActiveTab('warnings');
      }
    }
  }, [open, panelInfo.errorCount, panelInfo.warningCount]);

  useEffect(() => {
    const unsubscribe = EventsOn('holmes:analysis:update', (updatedIssue: MonitorIssue) => {
      if (!updatedIssue?.issueID) return;
      setPanelInfo((prev) => {
        if (!prev) return prev;
        const updateList = (list: MonitorIssue[]) =>
          list.map((issue) => (issue.issueID === updatedIssue.issueID ? { ...issue, ...updatedIssue } : issue));
        const errors = updateList(prev.errors || []);
        const warnings = updateList(prev.warnings || []);
        return {
          ...prev,
          errors,
          warnings,
        };
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

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

  if (!open) return null;

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    resizeRef.current = { startY, startH: height, resizing: true };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.resizing) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dy = resizeRef.current.startY - ev.clientY; // up increases height
      const next = Math.max(200, Math.min(resizeRef.current.startH + dy, Math.floor(window.innerHeight * 0.9)));
      setHeight(next);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };

    const onUp = (ev?: MouseEvent) => {
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

  const issues = activeTab === 'errors' ? panelInfo.errors || [] : panelInfo.warnings || [];

  // Deduplicate issues by stable IssueID (or computed fallback) to avoid
  // rendering duplicate React keys when the backend can emit repeated entries.
  const uniqueIssues = (() => {
    const seen = new Set<string>();
    const out: MonitorIssue[] = [];
    issues.forEach((issue) => {
      const id = issue.issueID || `${issue.resource || 'issue'}-${issue.namespace || 'ns'}-${issue.name || 'unknown'}-${issue.containerName || ''}-${issue.reason || ''}`;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(issue);
      }
    });
    return out;
  })();

  const handleAnalyzeIssue = async (issue: MonitorIssue) => {
    if (!issue?.issueID) return;
    setIssueLoading((prev) => ({ ...prev, [issue.issueID as string]: true }));
    try {
      const updated = await AnalyzeMonitorIssue(issue.issueID);
      if (updated?.issueID) {
        setPanelInfo((prev) => {
          const updateList = (list: MonitorIssue[]) =>
            list.map((item) => (item.issueID === updated.issueID ? { ...item, ...updated } : item));
          return {
            ...prev,
            errors: updateList(prev.errors || []),
            warnings: updateList(prev.warnings || []),
          };
        });
      }
    } catch (err) {
      console.error('AnalyzeMonitorIssue failed', err);
    } finally {
      setIssueLoading((prev) => ({ ...prev, [issue.issueID as string]: false }));
    }
  };

  const handleDismissIssue = async (issue: MonitorIssue) => {
    if (!issue?.issueID) return;
    setDismissLoading((prev) => ({ ...prev, [issue.issueID as string]: true }));
    try {
      await DismissMonitorIssue(issue.issueID);
      setPanelInfo((prev) => {
        const removeIssue = (list: MonitorIssue[]) => list.filter((item) => item.issueID !== issue.issueID);
        const errors = removeIssue(prev.errors || []);
        const warnings = removeIssue(prev.warnings || []);
        return {
          ...prev,
          errors,
          warnings,
          errorCount: errors.length,
          warningCount: warnings.length,
        };
      });
    } catch (err) {
      console.error('DismissMonitorIssue failed', err);
    } finally {
      setDismissLoading((prev) => ({ ...prev, [issue.issueID as string]: false }));
    }
  };

  const handleScan = async () => {
    setScanLoading(true);
    try {
      const info = await ScanClusterHealth();
      if (info) {
        setPanelInfo(info as MonitorInfo);
        if (info.errorCount > 0) {
          setActiveTab('errors');
        } else if (info.warningCount > 0) {
          setActiveTab('warnings');
        }
      }
    } catch (err) {
      console.error('ScanClusterHealth failed', err);
    } finally {
      setScanLoading(false);
    }
  };

  const handleAnalyzeAll = async () => {
    setAnalyzeAllLoading(true);
    try {
      await AnalyzeAllMonitorIssues();
    } catch (err) {
      console.error('AnalyzeAllMonitorIssues failed', err);
    } finally {
      setAnalyzeAllLoading(false);
    }
  };

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
        animation: 'slideUpPanel 0.2s ease-out',
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
          borderBottom: '1px solid var(--gh-border, #30363d)',
        }}
      />

      {/* Tabs header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--gh-bg-sidebar, #161b22)',
          borderBottom: '1px solid var(--gh-border, #30363d)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            id="monitor-tab-errors"
            onClick={() => setActiveTab('errors')}
            style={{
              border: '1px solid var(--gh-border, #30363d)',
              borderBottom:
                activeTab === 'errors' ? '2px solid var(--gh-accent, #238636)' : '1px solid var(--gh-border, #30363d)',
              background: activeTab === 'errors' ? 'rgba(56, 139, 253, 0.08)' : 'transparent',
              color: 'var(--gh-text, #c9d1d9)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Errors ({panelInfo.errorCount || 0})
          </button>
          <button
            id="monitor-tab-warnings"
            onClick={() => setActiveTab('warnings')}
            style={{
              border: '1px solid var(--gh-border, #30363d)',
              borderBottom:
                activeTab === 'warnings'
                  ? '2px solid var(--gh-accent, #238636)'
                  : '1px solid var(--gh-border, #30363d)',
              background: activeTab === 'warnings' ? 'rgba(219, 171, 9, 0.08)' : 'transparent',
              color: 'var(--gh-text, #c9d1d9)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Warnings ({panelInfo.warningCount || 0})
          </button>
          <button
            id="monitor-tab-prometheus"
            onClick={() => setActiveTab('prometheus')}
            style={{
              border: '1px solid var(--gh-border, #30363d)',
              borderBottom:
                activeTab === 'prometheus'
                  ? '2px solid var(--gh-accent, #238636)'
                  : '1px solid var(--gh-border, #30363d)',
              background: activeTab === 'prometheus' ? 'rgba(46, 160, 67, 0.08)' : 'transparent',
              color: 'var(--gh-text, #c9d1d9)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            Prometheus
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanLoading}
            style={{
              background: '#1f6feb',
              color: '#fff',
              border: '1px solid #1f6feb',
              borderRadius: 0,
              padding: '6px 10px',
              cursor: scanLoading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              opacity: scanLoading ? 0.7 : 1,
            }}
          >
            {scanLoading ? 'Scanning…' : 'Rescan'}
          </button>
          <button
            type="button"
            onClick={handleAnalyzeAll}
            disabled={analyzeAllLoading}
            style={{
              background: '#238636',
              color: '#fff',
              border: '1px solid #238636',
              borderRadius: 0,
              padding: '6px 10px',
              cursor: analyzeAllLoading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              opacity: analyzeAllLoading ? 0.7 : 1,
            }}
          >
            {analyzeAllLoading ? 'Analyzing…' : 'Analyze all'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid var(--gh-border, #30363d)',
              borderRadius: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'prometheus' ? (
          <PrometheusAlertsTab />
        ) : issues.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No issues found.</div>
        ) : (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {uniqueIssues.map((issue, idx) => (
              <MonitorIssueCard
                key={issue.issueID || `${issue.resource || 'issue'}-${issue.name || 'unknown'}-${idx}`}
                issue={issue}
                onNavigate={handleIssueClick}
                onAnalyze={handleAnalyzeIssue}
                onDismiss={handleDismissIssue}
                analyzing={Boolean(issue.issueID && issueLoading[issue.issueID])}
                dismissing={Boolean(issue.issueID && dismissLoading[issue.issueID])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonitorPanel;

