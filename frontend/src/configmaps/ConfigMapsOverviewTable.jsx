import React, { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../OverviewTableWithPanel';
import * as AppAPI from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'namespace', label: 'Namespace' },
  { key: 'keys', label: 'Keys' },
  { key: 'size', label: 'Size' },
  { key: 'age', label: 'Age' },
];

const bottomTabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'events', label: 'Events' },
  { key: 'yaml', label: 'YAML' },
];

function renderPanelContent(row, tab) {
  if (tab === 'summary') {
    return (
      <div>
        <h3>Summary</h3>
        <p><b>Name:</b> {row.name}</p>
        <p><b>Namespace:</b> {row.namespace}</p>
        <p><b>Keys:</b> {row.keys}</p>
        <p><b>Size:</b> {row.size}</p>
        <p><b>Age:</b> {row.age}</p>
      </div>
    );
  }
  if (tab === 'events') {
    return (
      <div>
        <h3>Events</h3>
        <p>No events (mock data).</p>
      </div>
    );
  }
  if (tab === 'yaml') {
    return (
      <div>
        <h3>YAML</h3>
        <pre style={{ background: '#222', color: '#eee', padding: 12 }}>
{`apiVersion: v1
kind: ConfigMap
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
data:
  # Configuration data would appear here
  key: value`}
        </pre>
      </div>
    );
  }
  return null;
}

export default function ConfigMapsOverviewTable({ namespace, onConfigMapCreate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Timers and guards as refs so we can restart fast polling on new creates
  const inFlightRef = useRef(false);
  const fastTimerRef = useRef(null);
  const slowTimerRef = useRef(null);

  const clearTimers = () => {
    if (fastTimerRef.current) {
      clearInterval(fastTimerRef.current);
      fastTimerRef.current = null;
    }
    if (slowTimerRef.current) {
      clearInterval(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  };

  const periodicFetch = async (ns) => {
    if (inFlightRef.current || !ns) return;
    inFlightRef.current = true;
    try {
      const configmaps = await AppAPI.GetConfigMaps(ns);
      setData(Array.isArray(configmaps) ? configmaps : []);
    } catch (_) {
      // ignore periodic errors
    } finally {
      inFlightRef.current = false;
    }
  };

  const startFastPollingWindow = (ns) => {
    if (!ns) return;
    clearTimers();
    let elapsed = 0;
    fastTimerRef.current = setInterval(async () => {
      await periodicFetch(ns);
      elapsed += 1;
      if (elapsed >= 60) {
        if (fastTimerRef.current) {
          clearInterval(fastTimerRef.current);
          fastTimerRef.current = null;
        }
        slowTimerRef.current = setInterval(() => periodicFetch(ns), 60000);
      }
    }, 1000);
  };

  const fetchConfigMaps = async () => {
    if (!namespace) return;

    setLoading(true);
    setError(null);
    try {
      const configmaps = await AppAPI.GetConfigMaps(namespace);
      setData(configmaps || []);
    } catch (err) {
      console.error('Error fetching configmaps:', err);
      setError(err.message || 'Failed to fetch configmaps');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigMaps();
    // Start a fast window when view opens
    startFastPollingWindow(namespace);
    return () => clearTimers();
  }, [namespace]);

  // Generic resource-updated fallback
  useEffect(() => {
    const unsubscribe = EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'configmap' && eventData?.namespace === namespace) {
        fetchConfigMaps();
        // Restart fast polling window upon new resource creation
        startFastPollingWindow(namespace);
      }
    });

    return () => {
      EventsOff('resource-updated', unsubscribe);
    };
  }, [namespace]);

  // Direct snapshot updates from backend (emitted after creates)
  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = namespace ? arr.filter(cm => (cm?.namespace || cm?.Namespace) === namespace) : arr;
        setData(filtered);
        // Restart fast polling window to ensure per-second Age updates for first minute
        startFastPollingWindow(namespace);
      } catch (_) {
        // ignore malformed payloads
      }
    };
    EventsOn('configmaps:update', onUpdate);
    return () => {
      EventsOff('configmaps:update', onUpdate);
    };
  }, [namespace]);

  return (
    <OverviewTableWithPanel
      title="Config Maps"
      data={data}
      columns={columns}
      loading={loading}
      error={error}
      tabs={bottomTabs}
      renderPanelContent={renderPanelContent}
      resourceKind="configmap"
      namespace={namespace}
      onResourceCreate={onConfigMapCreate}
    />
  );
}
