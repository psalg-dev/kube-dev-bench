import { useState, useEffect, useCallback } from 'react';
import { GetSwarmEvents as ApiGetSwarmEvents, GetSwarmServiceEvents as ApiGetSwarmServiceEvents } from '../swarmApi';
import './SwarmEventsTab.css';

interface SwarmEvent {
  time?: string;
  timeUnix?: number;
  type?: string;
  action?: string;
  actor?: string;
  actorName?: string;
}

interface SwarmEventsTabProps {
  serviceId?: string;
  sinceMinutes?: number;
}

/**
 * SwarmEventsTab - Displays Docker Swarm events
 */
export default function SwarmEventsTab({ serviceId, sinceMinutes = 30 }: SwarmEventsTabProps) {
  const [events, setEvents] = useState<SwarmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: SwarmEvent[] | null | undefined;
      if (serviceId) {
        data = await ApiGetSwarmServiceEvents(serviceId, sinceMinutes);
      } else {
        data = await ApiGetSwarmEvents(sinceMinutes);
      }
      // Sort by time descending (most recent first)
      const sorted = (data || []).sort((a, b) => (b.timeUnix || 0) - (a.timeUnix || 0));
      setEvents(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load events';
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId, sinceMinutes]);

  useEffect(() => {
    fetchEvents();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (loading && events.length === 0) {
    return (
      <div className="swarm-events-loading">
        <span className="spinner" /> Loading events...
      </div>
    );
  }

  if (error) {
    return (
      <div className="swarm-events-error">
        <span className="error-icon">⚠</span>
        <span>{error}</span>
        <button type="button" onClick={fetchEvents} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="swarm-events-empty">
        <div className="empty-icon">📋</div>
        <div className="empty-title">No Events</div>
        <div className="empty-hint">No events found in the last {sinceMinutes} minutes.</div>
      </div>
    );
  }

  const getEventTypeColor = (type?: string) => {
    switch (type) {
      case 'service':
        return '#58a6ff';
      case 'container':
        return '#3fb950';
      case 'node':
        return '#d29922';
      case 'network':
        return '#a371f7';
      case 'volume':
        return '#8b949e';
      case 'config':
        return '#79c0ff';
      case 'secret':
        return '#f85149';
      default:
        return '#8b949e';
    }
  };

  const getActionColor = (action?: string) => {
    if (!action) return '#8b949e';
    if (action.includes('create') || action.includes('start')) return '#3fb950';
    if (action.includes('remove') || action.includes('delete') || action.includes('die') || action.includes('kill')) {
      return '#f85149';
    }
    if (action.includes('update') || action.includes('scale')) return '#d29922';
    return '#8b949e';
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="swarm-events-tab">
      <div className="events-header">
        <span className="events-count">{events.length} events</span>
        <button type="button" onClick={fetchEvents} className="refresh-btn" title="Refresh events">
          ↻
        </button>
      </div>
      <div className="events-list">
        {events.map((event, idx) => (
          <div key={`${event.actor}-${event.timeUnix}-${idx}`} className="event-item">
            <div className="event-time">{formatTime(event.time)}</div>
            <div className="event-type" style={{ color: getEventTypeColor(event.type) }}>
              {event.type}
            </div>
            <div className="event-action" style={{ color: getActionColor(event.action) }}>
              {event.action}
            </div>
            <div className="event-actor" title={event.actor}>
              {event.actorName || (event.actor ? `${event.actor.substring(0, 12)}...` : '-')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}