import React, { useEffect, useState, useRef } from 'react';
import { GetPodSummary, StreamPodLogs, StopPodLogs, GetPodEvents, GetPodEventsLegacy } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

export default function PodSummaryTab({ podName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Logs state for the right panel (streaming, last 20 lines)
  const [logs, setLogs] = useState([]);
  const [logsFilter, setLogsFilter] = useState('');
  const logsContainerRef = useRef(null);
  // Events panel state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  const load = async () => {
    if (!podName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await GetPodSummary(podName);
      setData(res || null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Load last 5 events for the current pod (sorted by lastTimestamp desc)
  const loadEvents = async (ns) => {
    if (!podName) return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      let res = [];
      if (ns !== undefined) {
        try {
          res = await GetPodEvents(ns || '', podName);
        } catch (e) {
          // fallback to legacy if available
          try { res = await GetPodEventsLegacy(podName); } catch { throw e; }
        }
      } else {
        // if namespace unknown yet, try legacy
        res = await GetPodEventsLegacy(podName);
      }
      const arr = Array.isArray(res) ? res : [];
      arr.sort((a, b) => {
        const ta = a?.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
        const tb = b?.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
        return tb - ta; // desc
      });
      setEvents(arr.slice(0, 5));
    } catch (e) {
      setEventsError(String(e));
      // keep previous events on error to avoid flicker
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [podName]);

  // Load events when podName or namespace changes (after summary loaded)
  useEffect(() => {
    const ns = (data && data.namespace) ? data.namespace : undefined;
    loadEvents(ns);
    const id = setInterval(() => loadEvents(ns), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podName, data && data.namespace]);

  // Stream logs: subscribe to pod log events and start/stop backend stream
  useEffect(() => {
    if (!podName) return;
    setLogs([]); // reset on pod change
    const eventName = `podlogs:${podName}`;
    const listener = (line) => {
      const text = String(line ?? '');
      // Append and keep only last 20 lines
      setLogs(prev => (prev.length >= 20 ? [...prev.slice(1), text] : [...prev, text]));
    };
    EventsOn(eventName, listener);
    // start streaming from backend
    try { StreamPodLogs(podName); } catch {}
    return () => {
      // stop stream and unsubscribe
      try { StopPodLogs(podName); } catch {}
      try { EventsOff(eventName); } catch {}
    };
  }, [podName]);

  // Auto-scroll logs view to bottom when new lines arrive or filter changes
  useEffect(() => {
    const el = logsContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, logsFilter]);

  const renderLabels = (labels) => {
    if (!labels || Object.keys(labels).length === 0) return '-';
    const pairs = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pairs.map((p, i) => (
          <span key={i} style={{ background: 'rgba(56,139,253,0.12)', border: '1px solid #30363d', padding: '2px 6px', borderRadius: 0, color: '#c9d1d9' }}>{p}</span>
        ))}
      </div>
    );
  };

  const formatDuration = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const ms = Date.now() - d.getTime();
    if (ms < 0) return 'just now';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const days = Math.floor(h / 24);
    if (days > 0) return `${days}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const statusColors = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('run')) return { bg: 'rgba(46,160,67,0.15)', fg: '#3fb950', bd: '#30363d' }; // green
    if (s.includes('pend') || s.includes('init')) return { bg: 'rgba(187,128,9,0.12)', fg: '#d29922', bd: '#30363d' }; // yellow
    if (s.includes('fail') || s.includes('err') || s.includes('crash')) return { bg: 'rgba(248,81,73,0.12)', fg: '#f85149', bd: '#30363d' }; // red
    if (s.includes('succ')) return { bg: 'rgba(56,139,253,0.12)', fg: '#58a6ff', bd: '#30363d' }; // blue
    return { bg: 'rgba(110,118,129,0.12)', fg: '#8b949e', bd: '#30363d' }; // grey
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-sidebar, #161b22)', color: 'var(--gh-text, #c9d1d9)' }}>
        Summary for {podName}
      </div>
      {loading && <div style={{ padding: 12, color: 'var(--gh-text-muted, #8b949e)' }}>Loading…</div>}
      {error && <div style={{ padding: 12, color: '#f85149' }}>Error: {error}</div>}
      {!loading && !error && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          {/* Left-side panel (Quick info) */}
          <div style={{ width: 320, borderRight: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-canvas, #0d1117)', display: 'flex', flexDirection: 'column', minWidth: 260, textAlign: 'left' }}>
            <div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, textAlign: 'left' }}>Quick info</div>
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 10, flex: 1, overflow: 'auto', textAlign: 'left' }}>
              {data ? (
                <>
                  {/* Status (left) and Age (right) on one row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Status</div>
                      {(() => {
                        const c = statusColors(data.status);
                        return (
                          <span style={{ display: 'inline-block', padding: '2px 8px', border: `1px solid ${c.bd}`, background: c.bg, color: c.fg }}>
                            {data.status || '-'}
                          </span>
                        );
                      })()}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Age</div>
                      <div style={{ whiteSpace: 'nowrap' }}>{formatDuration(data.created)}</div>
                    </div>
                  </div>

                  {/* Namespace */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Namespace</div>
                    <div>{data.namespace || '-'}</div>
                  </div>

                  {/* Labels */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Labels</div>
                    {renderLabels(data.labels)}
                  </div>

                  {/* Pod name */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Pod name</div>
                    <div style={{ wordBreak: 'break-all' }}>{data.name || '-'}</div>
                  </div>

                  {/* Refresh */}
                  <div style={{ marginTop: 8 }}>
                    <button onClick={load} disabled={loading} style={{ padding: '6px 10px', background: 'rgba(56,139,253,0.15)', color: '#58a6ff', border: '1px solid #30363d', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                      {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No data.</div>
              )}
            </div>
          </div>

          {/* Middle panel: Logs (streaming, last 20 lines) */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column' }}>
            <div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>Logs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  value={logsFilter}
                  onChange={(e) => setLogsFilter(e.target.value)}
                  placeholder="Filter logs"
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--gh-border, #30363d)',
                    background: 'var(--gh-input-bg, #21262d)',
                    color: 'var(--gh-text, #c9d1d9)',
                    borderRadius: 0,
                    outline: 'none',
                    width: 220,
                    fontSize: 14,
                    height: 28,
                  }}
                />
              </div>
            </div>
            <div ref={logsContainerRef} className="scrollbar-hide-y" style={{ flex: 1, overflow: 'auto', padding: 12, background: 'var(--gh-bg-canvas, #0d1117)', color: 'var(--gh-text, #c9d1d9)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \'Liberation Mono\', \'Courier New\', monospace', fontSize: 13, lineHeight: 1.4, textAlign: 'left' }}>
              {(() => {
                const q = logsFilter.trim().toLowerCase();
                const filtered = q ? logs.filter(l => String(l).toLowerCase().includes(q)) : logs;
                if (filtered.length > 0) {
                  return <pre style={{ margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left' }}>{filtered.join('\n')}</pre>;
                }
                return <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>{q ? 'No logs match filter.' : 'No logs yet.'}</div>;
              })()}
            </div>
          </div>

          {/* Right-side panel: Events (last 5) */}
          <div style={{ width: 360, minWidth: 280, borderLeft: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-canvas, #0d1117)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Events</span>
              <span style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)' }}>{eventsLoading ? 'Updating…' : ''}</span>
            </div>
            <div className="scrollbar-hide-y" style={{ padding: 12, flex: 1, overflow: 'auto' }}>
              {(() => {
                const hasEvents = Array.isArray(events) && events.length > 0;
                if (hasEvents) {
                  return (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                      {events.map((e) => {
                        const key = `${e.lastTimestamp ?? ''}|${e.type ?? ''}|${e.reason ?? ''}|${(e.message || '').slice(0, 24)}`;
                        return (
                          <li key={key} style={{ borderBottom: '1px solid var(--gh-border, #30363d)', paddingBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ color: '#8b949e', fontSize: 12 }}>{e.type || '-'}</span>
                              <span style={{ color: '#8b949e', fontSize: 12 }}>{e.lastTimestamp ? new Date(e.lastTimestamp).toLocaleString() : '-'}</span>
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 600 }}>{e.reason || '-'}</div>
                            <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--gh-text, #c9d1d9)' }}>{e.message || '-'}</div>
                            {typeof e.count === 'number' && <div style={{ marginTop: 4, color: '#8b949e', fontSize: 12 }}>Count: {e.count}</div>}
                            {e.source && <div style={{ marginTop: 2, color: '#8b949e', fontSize: 12 }}>Source: {e.source}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  );
                }
                if (eventsLoading) return <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>Loading events…</div>;
                if (eventsError) return <div style={{ color: '#f85149' }}>Error: {eventsError}</div>;
                return <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No recent events.</div>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
