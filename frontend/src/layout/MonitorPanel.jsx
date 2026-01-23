import React, { useState, useRef, useEffect } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime.js';
import MonitorIssueCard from './MonitorIssueCard.jsx';
import PrometheusAlertsTab from './PrometheusAlertsTab.jsx';
import {
  AnalyzeAllMonitorIssues,
  AnalyzeMonitorIssue,
  DismissMonitorIssue,
  ScanClusterHealth,
} from './monitorApi.js';

export function MonitorPanel({ monitorInfo, open, onClose }) {
  const [activeTab, setActiveTab] = useState('errors');
  const [panelInfo, setPanelInfo] = useState(monitorInfo);
  const [scanLoading, setScanLoading] = useState(false);
  const [analyzeAllLoading, setAnalyzeAllLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState({});
  const [dismissLoading, setDismissLoading] = useState({});
  const [height, setHeight] = useState(() => {
    try { return Number(localStorage.getItem('monitorpanel.height')) || 400; } catch { return 400; }
  });
  const resizeRef = useRef({ startY: 0, startH: 0, resizing: false });

  useEffect(() => {
    setPanelInfo(monitorInfo);
  }, [monitorInfo]);

  useEffect(() => {
    try { localStorage.setItem('monitorpanel.height', String(height)); } catch {}
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
    const unsubscribe = EventsOn('holmes:analysis:update', (updatedIssue) => {
      if (!updatedIssue?.issueID) return;
      setPanelInfo((prev) => {
        if (!prev) return prev;
        const updateList = (list) => list.map((issue) => (
          issue.issueID === updatedIssue.issueID ? { ...issue, ...updatedIssue } : issue
        ));
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

  const issues = activeTab === 'errors' ? (panelInfo.errors || []) : (panelInfo.warnings || []);

  const handleAnalyzeIssue = async (issue) => {
    if (!issue?.issueID) return;
    setIssueLoading((prev) => ({ ...prev, [issue.issueID]: true }));
    try {
      const updated = await AnalyzeMonitorIssue(issue.issueID);
      if (updated?.issueID) {
        setPanelInfo((prev) => {
          const updateList = (list) => list.map((item) => (
            item.issueID === updated.issueID ? { ...item, ...updated } : item
          ));
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
      setIssueLoading((prev) => ({ ...prev, [issue.issueID]: false }));
    }
  };

  const handleDismissIssue = async (issue) => {
    if (!issue?.issueID) return;
    setDismissLoading((prev) => ({ ...prev, [issue.issueID]: true }));
    try {
      await DismissMonitorIssue(issue.issueID);
      setPanelInfo((prev) => {
        const removeIssue = (list) => list.filter((item) => item.issueID !== issue.issueID);
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
      setDismissLoading((prev) => ({ ...prev, [issue.issueID]: false }));
    }
  };

  const handleScan = async () => {
    setScanLoading(true);
    try {
      const info = await ScanClusterHealth();
      if (info) {
        setPanelInfo(info);
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
            Errors ({panelInfo.errorCount || 0})
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
            Warnings ({panelInfo.warningCount || 0})
          </button>
          <button
            id="monitor-tab-alerts"
            onClick={() => setActiveTab('alerts')}
            style={{
              border: '1px solid var(--gh-border, #30363d)',
              borderBottom: activeTab === 'alerts' ? '2px solid var(--gh-accent, #238636)' : '1px solid var(--gh-border, #30363d)',
              background: activeTab === 'alerts' ? 'rgba(56, 139, 253, 0.08)' : 'transparent',
              color: 'var(--gh-text, #c9d1d9)',
              padding: '6px 10px',
              cursor: 'pointer',
              borderRadius: 0,
              fontSize: 13
            }}
          >
            Prometheus Alerts
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanLoading}
            style={{
              background: '#238636',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              padding: '6px 10px'
            }}
          >
            {scanLoading ? 'Scanning…' : 'Scan Now'}
          </button>
          <button
            type="button"
            onClick={handleAnalyzeAll}
            disabled={analyzeAllLoading}
            style={{
              background: 'transparent',
              border: '1px solid var(--gh-border, #30363d)',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
              fontSize: 12,
              padding: '6px 10px'
            }}
          >
            {analyzeAllLoading ? 'Analyzing…' : 'Analyze All'}
          </button>
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
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '16px'
      }}>
        {activeTab === 'alerts' ? (
          <PrometheusAlertsTab />
        ) : issues.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            color: 'var(--gh-text-secondary, #8b949e)',
          }}>
            No {activeTab} found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {issues.map((issue) => (
              <MonitorIssueCard
                key={issue.issueID || `${issue.resource}-${issue.name}-${issue.reason}`}
                issue={issue}
                onNavigate={handleIssueClick}
                onAnalyze={handleAnalyzeIssue}
                onDismiss={handleDismissIssue}
                analyzing={issueLoading[issue.issueID]}
                dismissing={dismissLoading[issue.issueID]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MonitorPanel;
