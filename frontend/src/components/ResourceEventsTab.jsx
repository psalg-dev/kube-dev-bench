import React, { useEffect, useState, useRef } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import './ResourceEventsTab.css';

/**
 * Reusable events tab component for any Kubernetes resource type.
 * 
 * @param {string} namespace - The namespace of the resource
 * @param {string} kind - The Kubernetes resource kind (e.g., "Deployment", "StatefulSet")
 * @param {string} resourceKind - Alias for kind (for compatibility)
 * @param {string} name - The name of the resource
 * @param {string} resourceName - Alias for name (for compatibility)
 * @param {number} refreshInterval - Refresh interval in ms (default: 5000)
 */
export default function ResourceEventsTab({ namespace, kind, resourceKind, name, resourceName, refreshInterval = 5000 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Support both prop naming conventions
  const actualKind = kind || resourceKind;
  const actualName = name || resourceName;

  const fetchEvents = async (isInitial = false) => {
    if (!actualName || !actualKind) return;
    
    if (isInitial) setLoading(true);
    setError(null);
    
    try {
      const result = await AppAPI.GetResourceEvents(namespace || '', actualKind, actualName);
      setEvents(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || String(err));
      if (isInitial) setEvents([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(true);
    intervalRef.current = setInterval(() => fetchEvents(false), refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [namespace, actualKind, actualName, refreshInterval]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'warning':
        return { bg: 'rgba(187,128,9,0.15)', fg: '#d29922', border: '#d29922' };
      case 'normal':
        return { bg: 'rgba(46,160,67,0.15)', fg: '#3fb950', border: '#3fb950' };
      default:
        return { bg: 'rgba(110,118,129,0.12)', fg: '#8b949e', border: '#8b949e' };
    }
  };

  if (loading) {
    return (
      <div className="resource-events-tab">
        <div className="events-loading">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resource-events-tab">
        <div className="events-error">Error: {error}</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="resource-events-tab">
        <div className="events-empty">No events found for this {actualKind.toLowerCase()}.</div>
      </div>
    );
  }

  return (
    <div className="resource-events-tab">
      <div className="events-header">
        <span className="events-count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="events-list">
        <table className="events-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Message</th>
              <th>Count</th>
              <th>Last Seen</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, idx) => {
              const typeColor = getTypeColor(event.type);
              return (
                <tr key={idx} className="event-row">
                  <td>
                    <span 
                      className="event-type-badge"
                      style={{ 
                        background: typeColor.bg, 
                        color: typeColor.fg,
                        borderColor: typeColor.border 
                      }}
                    >
                      {event.type || 'Unknown'}
                    </span>
                  </td>
                  <td className="event-reason">{event.reason || '-'}</td>
                  <td className="event-message">{event.message || '-'}</td>
                  <td className="event-count">{event.count || 1}</td>
                  <td className="event-time">{formatTime(event.lastTimestamp)}</td>
                  <td className="event-source">{event.source || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
