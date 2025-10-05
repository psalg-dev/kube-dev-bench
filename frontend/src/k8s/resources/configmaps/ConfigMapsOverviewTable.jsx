import React, { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader.jsx';
import ResourceActions from '../../../components/ResourceActions.jsx';

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
    const quickInfoFields = [
      {
        key: 'keys',
        label: 'Keys',
        layout: 'flex',
        rightField: {
          key: 'age',
          label: 'Age',
          type: 'age',
          getValue: (data) => data.created || data.age
        }
      },
      { key: 'namespace', label: 'Namespace' },
      { key: 'size', label: 'Size' },
      { key: 'name', label: 'ConfigMap name', type: 'break-word' }
    ];

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="configmap" name={row.name} namespace={row.namespace} onDelete={async (n,ns)=>{await AppAPI.DeleteResource("configmap", ns, n);}} />} />
        <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
          <QuickInfoSection
            resourceName={row.name}
            data={row}
            loading={false}
            error={null}
            fields={quickInfoFields}
          />
          {/* Right side content area for additional information */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column', padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>ConfigMap Details</div>
            <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
              <strong>Keys:</strong> {row.keys || '-'}<br />
              <strong>Size:</strong> {row.size || '-'}<br />
              <strong>Namespace:</strong> {row.namespace || '-'}
            </div>
          </div>
        </div>
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
    const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
data:
  # Configuration data would appear here
  config.yaml: |
    key: value
    setting: example`;

    return <YamlTab content={yamlContent} />;
  }
  return null;
}

// Add helper normalization for configmaps to ensure labels property exists
const normalizeConfigMaps = (arr) => (arr || []).filter(Boolean).map(cm => ({
  ...cm,
  name: cm.name ?? cm.Name,
  namespace: cm.namespace ?? cm.Namespace,
  keys: cm.keys ?? cm.Keys ?? '-',
  size: cm.size ?? cm.Size ?? '-',
  age: cm.age ?? cm.Age ?? '-',
  labels: cm.labels ?? cm.Labels ?? cm.metadata?.labels ?? {}
}));

export default function ConfigMapsOverviewTable({ namespaces = [], namespace, onConfigMapCreate }) {
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

  // Fetch configmaps for all selected namespaces
  const fetchConfigMaps = async () => {
    const nsList = namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
    if (nsList.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      let allConfigMaps = [];
      for (const ns of nsList) {
        const configmaps = await AppAPI.GetConfigMaps(ns);
        allConfigMaps = allConfigMaps.concat(normalizeConfigMaps(configmaps || []));
      }
      setData(allConfigMaps);
    } catch (err) {
      setError(err.message || 'Failed to fetch configmaps');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fast polling for all selected namespaces
  const periodicFetch = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await fetchConfigMaps();
    } catch (_) {
      // ignore periodic errors
    } finally {
      inFlightRef.current = false;
    }
  };

  const startFastPollingWindow = () => {
    clearTimers();
    let elapsed = 0;
    fastTimerRef.current = setInterval(async () => {
      await periodicFetch();
      elapsed += 1;
      if (elapsed >= 60) {
        if (fastTimerRef.current) {
          clearInterval(fastTimerRef.current);
          fastTimerRef.current = null;
        }
        slowTimerRef.current = setInterval(() => periodicFetch(), 60000);
      }
    }, 1000);
  };

  useEffect(() => {
    fetchConfigMaps();
    startFastPollingWindow();
    return () => clearTimers();
  }, [JSON.stringify(namespaces), namespace]);

  // Generic resource-updated fallback
  useEffect(() => {
    const unsubscribe = EventsOn('resource-updated', (eventData) => {
      if (eventData?.resource === 'configmap' && (namespaces.includes(eventData?.namespace) || eventData?.namespace === namespace)) {
        fetchConfigMaps();
        startFastPollingWindow();
      }
    });
    return () => {
      EventsOff('resource-updated', unsubscribe);
    };
  }, [JSON.stringify(namespaces), namespace]);

  // Direct snapshot updates from backend (emitted after creates)
  useEffect(() => {
    const onUpdate = (list) => {
      try {
        const arr = Array.isArray(list) ? list : [];
        const filtered = arr.filter(cm => namespaces.includes(cm?.namespace || cm?.Namespace) || (cm?.namespace || cm?.Namespace) === namespace);
        setData(normalizeConfigMaps(filtered));
        startFastPollingWindow();
      } catch (_) {
        // ignore malformed payloads
      }
    };
    EventsOn('configmaps:update', onUpdate);
    return () => {
      EventsOff('configmaps:update', onUpdate);
    };
  }, [JSON.stringify(namespaces), namespace]);

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
