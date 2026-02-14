import { useCallback, useState } from 'react';
import * as AppAPI from '../../wailsjs/go/main/App';
import { useResourceWatch } from '../hooks/useResourceWatch';
import EmptyTabContent from './EmptyTabContent';
import { getEmptyTabMessage } from '../constants/emptyTabMessages';
import './ResourceEventsTab.css';

const RESOURCE_EVENTS_UPDATE_EVENT = 'resourceevents:update';

type ResourceEvent = {
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  lastTimestamp?: string;
  source?: string;
};

type ResourceEventsTabProps = {
  namespace?: string;
  kind?: string;
  resourceKind?: string;
  name?: string;
  resourceName?: string;
  refreshInterval?: number;
  limit?: number | null;
};

/**
 * Reusable events tab component for any Kubernetes resource type.
 */
export default function ResourceEventsTab({
  namespace,
  kind,
  resourceKind,
  name,
  resourceName,
  refreshInterval: _refreshInterval = 5000,
  limit = null,
}: ResourceEventsTabProps) {
  const [error, setError] = useState<string | null>(null);

  // Support both prop naming conventions
  const actualKind = kind || resourceKind;
  const actualName = name || resourceName;

  const fetchEvents = useCallback(async (): Promise<ResourceEvent[]> => {
    if (!actualName || !actualKind) return [];

    setError(null);
    try {
      const result = await AppAPI.GetResourceEvents(namespace || '', actualKind, actualName);
      const arr = Array.isArray(result) ? (result as ResourceEvent[]) : [];
      arr.sort((a, b) => {
        const ta = a?.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
        const tb = b?.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
        return tb - ta;
      });
      if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
        return arr.slice(0, limit);
      }
      return arr;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return [];
    }
  }, [actualKind, actualName, limit, namespace]);

  const { data: events, loading } = useResourceWatch<ResourceEvent>(
    RESOURCE_EVENTS_UPDATE_EVENT,
    fetchEvents,
    { mergeStrategy: 'replace', refetchOnSignal: true }
  );

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '-';
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getTypeColor = (type?: string) => {
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
    const emptyMsg = getEmptyTabMessage('events');
    return (
      <div className="resource-events-tab">
        <EmptyTabContent
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.description}
          tip={emptyMsg.tip}
        />
      </div>
    );
  }

  return (
    <div className="resource-events-tab">
      <div className="events-header">
        <span className="events-count">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
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
                        borderColor: typeColor.border,
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
