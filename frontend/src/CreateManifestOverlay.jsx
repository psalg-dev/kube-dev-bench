import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle, indentOnInput, indentUnit } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import * as AppAPI from '../wailsjs/go/main/App';
import { EventsEmit } from '../wailsjs/runtime';
import { showSuccess, showError } from './notification';
import ViewToggle from './components/forms/ViewToggle';
import ServiceForm from './components/forms/ServiceForm';
import useSwarmServiceForm, { getDefaultServiceForm } from './hooks/useSwarmServiceForm';
import {
  validateServiceForm,
  yamlToServiceForm,
  yamlToConfigForm,
  configFormToYaml,
  yamlToSecretForm,
  secretFormToYaml,
  yamlToNodeForm,
  nodeFormToYaml,
} from './utils/swarmYamlUtils';

function normalizeSwarmKind(kind) {
  const k = (kind || '').toString().trim().toLowerCase();
  // allow both singular and plural forms from callers
  if (k.endsWith('s')) {
    const singular = k.slice(0, -1);
    if (['service', 'task', 'node', 'network', 'config', 'secret', 'stack', 'volume'].includes(singular)) return singular;
  }
  return k;
}

function getDefaultSwarmPayload(kind) {
  switch (normalizeSwarmKind(kind)) {
    case 'config':
      return {
        name: 'my-config',
        data: '# Example Swarm config\nKEY=value\n',
        labels: {},
        editorMode: 'text',
      };
    case 'secret':
      return {
        name: 'my-secret',
        data: 'supersecret',
        labels: {},
        editorMode: 'text',
      };
    case 'service':
      return {
        name: 'my-service',
        data: `name: my-service\nimage: nginx:latest\nmode: replicated\nreplicas: 1\nports:\n  # - protocol: tcp\n  #   targetPort: 80\n  #   publishedPort: 8080\n  #   publishMode: ingress\nenv:\n  # KEY: value\nlabels:\n  # com.example.label: value\n`,
        labels: {},
        editorMode: 'yaml',
      };
    case 'stack':
      return {
        name: 'my-stack',
        data: `version: "3.8"\nservices:\n  web:\n    image: nginx:latest\n    deploy:\n      replicas: 1\n    ports:\n      - "8080:80"\n`,
        labels: {},
        editorMode: 'yaml',
      };
    default:
      return {
        name: '',
        data: '',
        labels: {},
        editorMode: 'text',
      };
  }
}

function parseKeyValueLabels(input) {
  const out = {};
  const lines = (input || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

function keyValueRowsToObject(rows) {
  const out = {};
  for (const row of rows || []) {
    const k = (row?.key || '').trim();
    if (!k) continue;
    out[k] = (row?.value || '').toString();
  }
  return out;
}

function objectToKeyValueRows(obj) {
  const o = obj || {};
  return Object.keys(o).sort().map((k) => ({ id: `kv_${k}`, key: k, value: (o[k] ?? '').toString() }));
}

function KeyValueEditor({
  title,
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addButtonLabel,
  ariaPrefix,
}) {
  return (
    <div style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: '#bbb' }}>{title}</div>
        <button
          type="button"
          onClick={() => onChange([...(rows || []), { id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' }])}
          style={{ padding: '6px 10px', background: 'transparent', color: '#fff', border: '1px solid #30363d', borderRadius: 0, cursor: 'pointer', fontSize: 12 }}
          aria-label={addButtonLabel}
        >
          {addButtonLabel}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 8, alignItems: 'center', maxWidth: '100%' }}>
        {(rows || []).map((row, idx) => (
          <React.Fragment key={row.id || idx}>
            <input
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...next[idx], key: e.target.value };
                onChange(next);
              }}
              placeholder={keyPlaceholder}
              aria-label={`${ariaPrefix} key`}
              style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
            />
            <input
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...next[idx], value: e.target.value };
                onChange(next);
              }}
              placeholder={valuePlaceholder}
              aria-label={`${ariaPrefix} value`}
              style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => {
                const next = (rows || []).filter((_, i) => i !== idx);
                onChange(next.length ? next : [{ id: `kv_${Date.now()}_${Math.random().toString(16).slice(2)}`, key: '', value: '' }]);
              }}
              style={{ padding: '8px 10px', background: 'transparent', color: '#fff', border: '1px solid #30363d', borderRadius: 0, cursor: 'pointer' }}
              aria-label={`Remove ${ariaPrefix.toLowerCase()} row`}
              title="Remove"
            >
              ×
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function getDefaultManifest(kind, namespace) {
  const ns = namespace || 'default';
  switch ((kind || '').toLowerCase()) {
    case 'deployment':
      return `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-deployment\n  namespace: ${ns}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: my-app\n  template:\n    metadata:\n      labels:\n        app: my-app\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n        ports:\n        - containerPort: 80\n`;
    case 'job':
      return `apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: my-job\n  namespace: ${ns}\nspec:\n  template:\n    spec:\n      restartPolicy: Never\n      containers:\n      - name: job\n        image: busybox\n        command: ["sh", "-c", "echo hello; sleep 30"]\n  backoffLimit: 2\n`;
    case 'cronjob':
      return `apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: my-cronjob\n  namespace: ${ns}\nspec:\n  schedule: "*/5 * * * *"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: OnFailure\n          containers:\n          - name: cron\n            image: busybox\n            command: ["sh", "-c", "date; echo Hello from the Kubernetes cluster"]\n`;
    case 'daemonset':
      return `apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: my-daemonset\n  namespace: ${ns}\nspec:\n  selector:\n    matchLabels:\n      app: my-daemon\n  template:\n    metadata:\n      labels:\n        app: my-daemon\n    spec:\n      containers:\n      - name: daemon\n        image: nginx:latest\n`;
    case 'statefulset':
      return `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: my-statefulset\n  namespace: ${ns}\nspec:\n  serviceName: "stateful-service"\n  replicas: 1\n  selector:\n    matchLabels:\n      app: my-stateful\n  template:\n    metadata:\n      labels:\n        app: my-stateful\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n`;
    case 'replicaset':
      return `apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: my-replicaset\n  namespace: ${ns}\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: my-app\n  template:\n    metadata:\n      labels:\n        app: my-app\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n`;
    case 'configmap':
      return `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-config\n  namespace: ${ns}\ndata:\n  # Configuration data as key-value pairs\n  app.properties: |\n    debug=true\n    database.host=localhost\n    database.port=5432\n  config.yaml: |\n    server:\n      port: 8080\n      host: 0.0.0.0\n    logging:\n      level: info\n  simple-key: simple-value\n`;
    case 'secret':
      return `apiVersion: v1\nkind: Secret\nmetadata:\n  name: my-secret\n  namespace: ${ns}\ntype: Opaque\nstringData:\n  # plain text values; will be base64-encoded by the API server\n  username: user\n  password: pass\n`;
    case 'ingress':
      return `apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: my-ingress\n  namespace: ${ns}\n  annotations:\n    kubernetes.io/ingress.class: nginx\nspec:\n  rules:\n  - host: example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: example-service\n            port:\n              number: 80\n  # tls:\n  # - hosts:\n  #   - example.com\n  #   secretName: example-tls\n`;
    case 'persistentvolumeclaim':
      return `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: my-pvc\n  namespace: ${ns}\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Gi\n  # Optional: specify storage class\n  # storageClassName: fast-ssd\n  # Optional: selector for existing PV\n  # selector:\n  #   matchLabels:\n  #     type: local\n`;
    case 'persistentvolume':
      // PersistentVolume is cluster-scoped; no namespace field
      return `apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: my-pv\n  labels:\n    type: local\nspec:\n  storageClassName: manual\n  capacity:\n    storage: 10Gi\n  accessModes:\n    - ReadWriteOnce\n  persistentVolumeReclaimPolicy: Retain\n  hostPath:\n    path: "/mnt/data"\n  # Alternative volume sources:\n  # nfs:\n  #   server: nfs-server.example.com\n  #   path: /path/to/nfs/share\n  # awsElasticBlockStore:\n  #   volumeID: vol-12345678\n  #   fsType: ext4\n  # gcePersistentDisk:\n  #   pdName: my-data-disk\n  #   fsType: ext4\n`;
    default:
      return `# Unknown kind: ${kind || 'Resource'}\n# Edit as needed\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: example\n  namespace: ${ns}\ndata:\n  key: value\n`;
  }
}

export default function CreateManifestOverlay({ open, kind, namespace, onClose, platform = 'k8s', createHint }) {
  const editorParentRef = useRef(null);
  const viewRef = useRef(null);
  const swarmStackFileInputRef = useRef(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [swarmName, setSwarmName] = useState('');
  const [swarmLabelRows, setSwarmLabelRows] = useState([{ id: 'kv_init', key: '', value: '' }]);
  const [swarmSimpleViewMode, setSwarmSimpleViewMode] = useState('form');
  const [swarmDataText, setSwarmDataText] = useState('');

  const [swarmNodeId, setSwarmNodeId] = useState('');
  const [swarmNodeAvailability, setSwarmNodeAvailability] = useState('active');
  const [swarmNodeRole, setSwarmNodeRole] = useState('worker');

  const swarmServiceForm = useSwarmServiceForm();
  const [swarmStackName, setSwarmStackName] = useState('');

  // Swarm structured create fields (used for networks/volumes)
  const [swarmNetworkDriver, setSwarmNetworkDriver] = useState('overlay');
  const [swarmNetworkScope, setSwarmNetworkScope] = useState('swarm');
  const [swarmNetworkAttachable, setSwarmNetworkAttachable] = useState(true);
  const [swarmNetworkInternal, setSwarmNetworkInternal] = useState(false);
  const [swarmNetworkSubnet, setSwarmNetworkSubnet] = useState('');
  const [swarmNetworkGateway, setSwarmNetworkGateway] = useState('');

  const [swarmVolumeDriver, setSwarmVolumeDriver] = useState('local');
  const [swarmVolumeDriverOptRows, setSwarmVolumeDriverOptRows] = useState([{ id: 'kv_init_opts', key: '', value: '' }]);

  const initial = useMemo(() => {
    if (platform === 'swarm') {
      const payload = getDefaultSwarmPayload(kind);
      return payload.data;
    }
    return getDefaultManifest(kind, namespace);
  }, [kind, namespace, platform]);

  const cmTheme = useMemo(() => EditorView.theme({
    '&': { backgroundColor: '#0d1117', color: '#c9d1d9' },
    '&.cm-editor': { height: '100%', width: '100%' },
    '.cm-content': { caretColor: '#fff', textAlign: 'left', whiteSpace: 'pre' },
    '.cm-line': { textAlign: 'left', whiteSpace: 'pre' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', lineHeight: '1.45' },
    '.cm-gutters': { background: '#161b22', color: '#8b949e', borderRight: '1px solid #30363d' },
    '.cm-gutterElement': { padding: '0 8px' },
  }, { dark: true }), []);

  const cmExtensions = useMemo(() => [
    cmTheme,
    // For swarm we still use YAML highlighting for compose-like payloads.
    yamlLang(),
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    indentOnInput(),
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
      ...foldKeymap,
    ]),
    syntaxHighlighting(defaultHighlightStyle),
  ], [cmTheme]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSubmitting(false);
    setText(initial);
    if (platform === 'swarm') {
      const payload = getDefaultSwarmPayload(kind);
      setSwarmName(payload.name || '');
      setSwarmLabelRows(objectToKeyValueRows(payload.labels || {}).concat([{ id: 'kv_new', key: '', value: '' }]));

      const k0 = normalizeSwarmKind(kind);
      if (k0 === 'config' || k0 === 'secret') {
        setSwarmDataText(payload.data || '');
        setSwarmSimpleViewMode('form');
      }

      if (k0 === 'node') {
        setSwarmNodeId('');
        setSwarmNodeAvailability('active');
        setSwarmNodeRole('worker');
        setSwarmSimpleViewMode('form');
      }

      const k = k0;
      if (k === 'service') {
        swarmServiceForm.setFormData(getDefaultServiceForm());
        swarmServiceForm.setYamlText('');
        swarmServiceForm.setViewMode('form');
      }

      if (k === 'stack') {
        setSwarmStackName(payload.name || '');
      }
      if (k === 'network') {
        setSwarmNetworkDriver('overlay');
        setSwarmNetworkScope('swarm');
        setSwarmNetworkAttachable(true);
        setSwarmNetworkInternal(false);
        setSwarmNetworkSubnet('');
        setSwarmNetworkGateway('');
      }
      if (k === 'volume') {
        setSwarmVolumeDriver('local');
        setSwarmVolumeDriverOptRows([{ id: 'kv_new_opts', key: '', value: '' }]);
      }
    }
  }, [open, initial]);

  // When switching away from an editor view (e.g. Service Form mode), destroy CodeMirror to avoid stale hidden editors.
  const isSwarm = platform === 'swarm';
  const swarmKind = isSwarm ? normalizeSwarmKind(kind) : '';
  const isSwarmSimpleKind = isSwarm && ['config', 'secret', 'node'].includes(swarmKind);
  const showSwarmEditor = !isSwarm || (
    swarmKind !== 'network' &&
    swarmKind !== 'volume' &&
    !(swarmKind === 'service' && swarmServiceForm.viewMode === 'form') &&
    !(isSwarmSimpleKind && swarmSimpleViewMode === 'form')
  );

  useEffect(() => {
    if (!open) return;
    if (!showSwarmEditor && viewRef.current) {
      try { viewRef.current.destroy(); } catch {}
      viewRef.current = null;
    }
  }, [open, showSwarmEditor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!showSwarmEditor) return;
    // mount or update editor
    try {
      if (!viewRef.current && editorParentRef.current) {
        const state = EditorState.create({ doc: text || '', extensions: cmExtensions });
        viewRef.current = new EditorView({ state, parent: editorParentRef.current });
      } else if (viewRef.current) {
        const cur = viewRef.current.state.doc.toString();
        if (cur !== (text || '')) {
          viewRef.current.dispatch({ changes: { from: 0, to: viewRef.current.state.doc.length, insert: text || '' } });
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to mount manifest editor:', e);
    }
  }, [open, showSwarmEditor, text, cmExtensions]);

  // NEW: destroy the view when overlay closes so it mounts fresh next time
  useEffect(() => {
    if (open) return;
    if (viewRef.current) {
      try { viewRef.current.destroy(); } catch {}
      viewRef.current = null;
    }
  }, [open]);

  useEffect(() => () => { try { viewRef.current?.destroy(); } catch {} viewRef.current = null; }, []);

  if (!open) return null;

  const title = (() => {
    if (platform === 'swarm') {
      const k = normalizeSwarmKind(kind);
      if (!k) return 'New Swarm resource';
      return `New Swarm ${k}`;
    }
    return kind ? `New ${kind} manifest` : 'New manifest';
  })();

  const getCurrentText = () => (viewRef.current ? viewRef.current.state.doc.toString() : text || '');

  async function readTextFile(file) {
    if (!file) return '';
    if (typeof file.text === 'function') {
      return await file.text();
    }
    return await new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsText(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function handleSwarmStackFileSelected(file) {
    try {
      const content = await readTextFile(file);
      setError('');
      setText(content);
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  async function handleCreate() {
    try {
      setSubmitting(true);
      setError('');
      const manifest = getCurrentText();

      if (platform === 'swarm') {
        const k = normalizeSwarmKind(kind);
        const labels = keyValueRowsToObject(swarmLabelRows);

        // Only implement supported backend RPCs.
        if (k === 'config') {
          let name = '';
          let data = '';
          let lbls = labels;

          if (swarmSimpleViewMode === 'yaml') {
            try {
              const parsed = yamlToConfigForm(manifest);
              name = (parsed.name || '').trim();
              data = (parsed.data || '');
              lbls = parsed.labels || {};
            } catch (e) {
              setError(e?.message || String(e));
              setSubmitting(false);
              return;
            }
          } else {
            name = (swarmName || '').trim();
            data = swarmDataText || '';
          }

          if (!name) {
            setError('Name is required.');
            setSubmitting(false);
            return;
          }
          if (!String(data || '').trim()) {
            setError('Payload is empty.');
            setSubmitting(false);
            return;
          }

          await AppAPI.CreateSwarmConfig(name, data, lbls);
          showSuccess(`Swarm config "${name}" was created successfully!`);
          try { EventsEmit('swarm:configs:update', null); } catch {}
          onClose?.();
          return;
        }

        if (k === 'secret') {
          let name = '';
          let data = '';
          let lbls = labels;

          if (swarmSimpleViewMode === 'yaml') {
            try {
              const parsed = yamlToSecretForm(manifest);
              name = (parsed.name || '').trim();
              data = (parsed.data || '');
              lbls = parsed.labels || {};
            } catch (e) {
              setError(e?.message || String(e));
              setSubmitting(false);
              return;
            }
          } else {
            name = (swarmName || '').trim();
            data = swarmDataText || '';
          }

          if (!name) {
            setError('Name is required.');
            setSubmitting(false);
            return;
          }
          if (!String(data || '').trim()) {
            setError('Payload is empty.');
            setSubmitting(false);
            return;
          }

          await AppAPI.CreateSwarmSecret(name, data, lbls);
          showSuccess(`Swarm secret "${name}" was created successfully!`);
          try { EventsEmit('swarm:secrets:update', null); } catch {}
          onClose?.();
          return;
        }

        if (k === 'node') {
          let nodeId = '';
          let availability = '';
          let role = '';
          let lbls = labels;

          if (swarmSimpleViewMode === 'yaml') {
            try {
              const parsed = yamlToNodeForm(manifest);
              nodeId = (parsed.id || '').trim();
              availability = (parsed.availability || 'active').trim();
              role = (parsed.role || 'worker').trim();
              lbls = parsed.labels || {};
            } catch (e) {
              setError(e?.message || String(e));
              setSubmitting(false);
              return;
            }
          } else {
            nodeId = (swarmNodeId || '').trim();
            availability = (swarmNodeAvailability || 'active').trim();
            role = (swarmNodeRole || 'worker').trim();
          }

          if (!nodeId) {
            setError('Node ID is required.');
            setSubmitting(false);
            return;
          }
          if (!availability) availability = 'active';
          if (!role) role = 'worker';

          await AppAPI.UpdateSwarmNodeAvailability(nodeId, availability);
          await AppAPI.UpdateSwarmNodeRole(nodeId, role);
          await AppAPI.UpdateSwarmNodeLabels(nodeId, lbls);

          showSuccess(`Swarm node "${nodeId}" was updated successfully!`);
          try { EventsEmit('swarm:nodes:update', null); } catch {}
          onClose?.();
          return;
        }

        if (k === 'service') {
          let data = swarmServiceForm.formData;

          if (swarmServiceForm.viewMode === 'yaml') {
            try {
              data = yamlToServiceForm(manifest);
            } catch (e) {
              setError(e?.message || String(e));
              setSubmitting(false);
              return;
            }
          }

          const errs = validateServiceForm(data);
          swarmServiceForm.setFormData(data);
          swarmServiceForm.validate(data);
          if (Object.keys(errs).length) {
            setSubmitting(false);
            return;
          }

          const opts = swarmServiceForm.toCreateOptions(data);
          await AppAPI.CreateSwarmService(opts);
          showSuccess(`Swarm service "${opts.name}" was created successfully!`);
          try { EventsEmit('swarm:services:update', null); } catch {}
          onClose?.();
          return;
        }

        if (k === 'stack') {
          const name = (swarmStackName || '').trim();
          if (!name) {
            setError('Name is required.');
            setSubmitting(false);
            return;
          }
          if (!manifest.trim()) {
            setError('Compose YAML is empty.');
            setSubmitting(false);
            return;
          }
          await AppAPI.CreateSwarmStack(name, manifest);
          showSuccess(`Swarm stack "${name}" was deployed successfully!`);
          try { EventsEmit('swarm:stacks:update', null); } catch {}
          onClose?.();
          return;
        }

        if (k === 'network') {
          const name = (swarmName || '').trim();
          if (!name) {
            setError('Name is required.');
            setSubmitting(false);
            return;
          }
          const opts = {
            scope: (swarmNetworkScope || '').trim(),
            attachable: !!swarmNetworkAttachable,
            internal: !!swarmNetworkInternal,
            labels,
            subnet: (swarmNetworkSubnet || '').trim(),
            gateway: (swarmNetworkGateway || '').trim(),
          };
          await AppAPI.CreateSwarmNetwork(name, (swarmNetworkDriver || '').trim() || 'overlay', opts);
          showSuccess(`Swarm network "${name}" was created successfully!`);
          try { EventsEmit('swarm:networks:update', null); } catch {}
          onClose?.();
          return;
        }

        if (k === 'volume') {
          const name = (swarmName || '').trim();
          if (!name) {
            setError('Name is required.');
            setSubmitting(false);
            return;
          }
          const driverOpts = keyValueRowsToObject(swarmVolumeDriverOptRows);
          await AppAPI.CreateSwarmVolume(name, (swarmVolumeDriver || '').trim() || 'local', labels, driverOpts);
          showSuccess(`Swarm volume "${name}" was created successfully!`);
          try { EventsEmit('swarm:volumes:update', null); } catch {}
          onClose?.();
          return;
        }

        setError(`Create is not implemented for Swarm ${k || 'resource'} yet.`);
        showError(`Create is not implemented for Swarm ${k || 'resource'} yet.`);
        setSubmitting(false);
        return;
      }

      if (!manifest.trim()) {
        setError('Manifest is empty.');
        setSubmitting(false);
        return;
      }

      const ns = namespace || '';
      await AppAPI.CreateResource(ns, manifest);
      const kindText = (kind || 'resource').toString();
      showSuccess(`${kindText} was created successfully!`);
      // Inform other views to refresh
      try { EventsEmit('resource-updated', { resource: (kindText || '').toLowerCase(), namespace: ns }); } catch {}
      onClose?.();
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
      showError(`Error creating resource: ${msg}`);
      setSubmitting(false);
    }
  }

  async function handleServiceViewChange(nextMode) {
    if (nextMode === swarmServiceForm.viewMode) return;

    if (nextMode === 'yaml') {
      const result = swarmServiceForm.switchTo('yaml');
      if (result.ok) {
        setText(swarmServiceForm.formToYaml(swarmServiceForm.formData));
      }
      return;
    }

    // YAML -> Form
    const yamlText = getCurrentText();
    try {
      const nextForm = yamlToServiceForm(yamlText);
      swarmServiceForm.setFormData(nextForm);
      swarmServiceForm.setViewMode('form');
      swarmServiceForm.validate(nextForm);
      setError('');
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
      showError(msg);
    }
  }

  async function handleSimpleViewChange(nextMode) {
    if (nextMode === swarmSimpleViewMode) return;

    if (nextMode === 'yaml') {
      const k = swarmKind;
      const labels = keyValueRowsToObject(swarmLabelRows);
      if (k === 'config') {
        setText(configFormToYaml({ name: swarmName, data: swarmDataText, labels }));
      } else if (k === 'secret') {
        setText(secretFormToYaml({ name: swarmName, data: swarmDataText, labels }));
      } else if (k === 'node') {
        setText(nodeFormToYaml({ id: swarmNodeId, availability: swarmNodeAvailability, role: swarmNodeRole, labels }));
      }
      setSwarmSimpleViewMode('yaml');
      setError('');
      return;
    }

    // YAML -> Form
    const yamlText = getCurrentText();
    try {
      const k = swarmKind;
      if (k === 'config') {
        const nextForm = yamlToConfigForm(yamlText);
        setSwarmName(nextForm.name || '');
        setSwarmDataText(nextForm.data || '');
        setSwarmLabelRows(objectToKeyValueRows(nextForm.labels || {}).concat([{ id: 'kv_new', key: '', value: '' }]));
      } else if (k === 'secret') {
        const nextForm = yamlToSecretForm(yamlText);
        setSwarmName(nextForm.name || '');
        setSwarmDataText(nextForm.data || '');
        setSwarmLabelRows(objectToKeyValueRows(nextForm.labels || {}).concat([{ id: 'kv_new', key: '', value: '' }]));
      } else if (k === 'node') {
        const nextForm = yamlToNodeForm(yamlText);
        setSwarmNodeId(nextForm.id || '');
        setSwarmNodeAvailability(nextForm.availability || 'active');
        setSwarmNodeRole(nextForm.role || 'worker');
        setSwarmLabelRows(objectToKeyValueRows(nextForm.labels || {}).concat([{ id: 'kv_new', key: '', value: '' }]));
      }
      setSwarmSimpleViewMode('form');
      setError('');
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg);
      showError(msg);
    }
  }

  return (
    <div id={isSwarm ? 'swarm-create-overlay' : undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '70%', maxWidth: 900, height: '75vh', background: 'var(--gh-table-header-bg, #2d323b)', border: '1px solid #353a42', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', color: '#fff', display: 'grid', gridTemplateRows: 'auto 1fr auto', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #353a42', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{title}</span>
          <button onClick={onClose} aria-label="Close" title="Close" style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 0, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {isSwarm && swarmKind === 'service' && (
            <div style={{ padding: 16, borderBottom: '1px solid #353a42', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {createHint ? (
                <div id="swarm-service-hint" style={{ fontSize: 12, color: '#bbb', lineHeight: 1.35 }}>
                  {String(createHint)}
                </div>
              ) : null}

              <ViewToggle mode={swarmServiceForm.viewMode} onChange={handleServiceViewChange} />

              {swarmServiceForm.viewMode === 'form' ? (
                <ServiceForm
                  data={swarmServiceForm.formData}
                  onChange={(d) => {
                    swarmServiceForm.setFormData(d);
                    swarmServiceForm.validate(d);
                  }}
                  errors={swarmServiceForm.errors}
                />
              ) : null}
            </div>
          )}

          {isSwarm && ['config', 'secret', 'node'].includes(swarmKind) && (
            <div style={{ padding: 16, borderBottom: '1px solid #353a42', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ViewToggle mode={swarmSimpleViewMode} onChange={handleSimpleViewChange} />

              {swarmSimpleViewMode === 'form' && swarmKind !== 'node' ? (
                <>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Name</div>
                    <input
                      value={swarmName}
                      onChange={(e) => setSwarmName(e.target.value)}
                      placeholder={swarmKind === 'secret' ? 'my-secret' : 'my-config'}
                      aria-label="Swarm resource name"
                      style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>
                  <KeyValueEditor
                    title="Labels"
                    rows={swarmLabelRows}
                    onChange={setSwarmLabelRows}
                    keyPlaceholder="com.example.owner"
                    valuePlaceholder="dev"
                    addButtonLabel="Add label"
                    ariaPrefix="Label"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>{swarmKind === 'secret' ? 'Value' : 'Data'}</div>
                    <textarea
                      value={swarmDataText}
                      onChange={(e) => setSwarmDataText(e.target.value)}
                      aria-label={swarmKind === 'secret' ? 'Swarm secret value' : 'Swarm config data'}
                      style={{ width: '100%', minHeight: 140, padding: '10px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', lineHeight: 1.45 }}
                    />
                  </div>
                </>
              ) : null}

              {swarmSimpleViewMode === 'form' && swarmKind === 'node' ? (
                <>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Node ID</div>
                    <input
                      value={swarmNodeId}
                      onChange={(e) => setSwarmNodeId(e.target.value)}
                      placeholder="node-id"
                      aria-label="Swarm node id"
                      style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Availability</div>
                      <select
                        value={swarmNodeAvailability}
                        onChange={(e) => setSwarmNodeAvailability(e.target.value)}
                        aria-label="Swarm node availability"
                        style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                      >
                        <option value="active">active</option>
                        <option value="pause">pause</option>
                        <option value="drain">drain</option>
                      </select>
                    </div>
                    <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Role</div>
                      <select
                        value={swarmNodeRole}
                        onChange={(e) => setSwarmNodeRole(e.target.value)}
                        aria-label="Swarm node role"
                        style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                      >
                        <option value="worker">worker</option>
                        <option value="manager">manager</option>
                      </select>
                    </div>
                  </div>
                  <KeyValueEditor
                    title="Labels"
                    rows={swarmLabelRows}
                    onChange={setSwarmLabelRows}
                    keyPlaceholder="com.example.owner"
                    valuePlaceholder="dev"
                    addButtonLabel="Add label"
                    ariaPrefix="Label"
                  />
                </>
              ) : null}
            </div>
          )}

          {isSwarm && swarmKind === 'stack' && (
            <div style={{ padding: 16, borderBottom: '1px solid #353a42', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Stack Name</div>
                <input
                  id="swarm-stack-name"
                  value={swarmStackName}
                  onChange={(e) => setSwarmStackName(e.target.value)}
                  placeholder="my-stack"
                  aria-label="Swarm stack name"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => swarmStackFileInputRef.current?.click?.()}
                  style={{ padding: '6px 10px', background: 'transparent', color: '#fff', border: '1px solid #30363d', borderRadius: 0, cursor: 'pointer', fontSize: 12 }}
                >
                  Upload YAML
                </button>
                <input
                  ref={swarmStackFileInputRef}
                  type="file"
                  accept=".yml,.yaml,text/yaml,application/x-yaml,text/plain"
                  aria-label="Swarm stack compose file"
                  onChange={async (e) => {
                    const file = e?.target?.files?.[0];
                    // allow re-selecting the same file
                    if (e?.target) e.target.value = '';
                    if (!file) return;
                    await handleSwarmStackFileSelected(file);
                  }}
                  style={{ display: 'none' }}
                />
              </div>
              <div
                id="swarm-stack-hint"
                style={{ fontSize: 12, color: '#bbb', lineHeight: 1.35 }}
              >
                Deploying a stack will create services (and their tasks).
              </div>
            </div>
          )}

          {isSwarm && swarmKind !== 'service' && swarmKind !== 'stack' && !['config', 'secret', 'node'].includes(swarmKind) && (
            <div style={{ padding: 16, borderBottom: '1px solid #353a42', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Name</div>
                <input
                  value={swarmName}
                  onChange={(e) => setSwarmName(e.target.value)}
                  placeholder="name"
                  aria-label="Swarm resource name"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <KeyValueEditor
                title="Labels"
                rows={swarmLabelRows}
                onChange={setSwarmLabelRows}
                keyPlaceholder="com.example.owner"
                valuePlaceholder="dev"
                addButtonLabel="Add label"
                ariaPrefix="Label"
              />
            </div>
          )}
          {isSwarm && swarmKind === 'network' && (
            <div style={{ padding: 16, borderBottom: '1px solid #353a42', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Driver</div>
                <select
                  value={swarmNetworkDriver}
                  onChange={(e) => setSwarmNetworkDriver(e.target.value)}
                  aria-label="Network driver"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="overlay">overlay</option>
                  <option value="bridge">bridge</option>
                  <option value="macvlan">macvlan</option>
                  <option value="host">host</option>
                </select>
              </div>
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Scope</div>
                <select
                  value={swarmNetworkScope}
                  onChange={(e) => setSwarmNetworkScope(e.target.value)}
                  aria-label="Network scope"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="swarm">swarm</option>
                  <option value="local">local</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 2 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#bbb' }}>
                  <input type="checkbox" checked={swarmNetworkAttachable} onChange={(e) => setSwarmNetworkAttachable(e.target.checked)} />
                  Attachable
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#bbb' }}>
                  <input type="checkbox" checked={swarmNetworkInternal} onChange={(e) => setSwarmNetworkInternal(e.target.checked)} />
                  Internal
                </label>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Subnet (CIDR)</div>
                <input
                  value={swarmNetworkSubnet}
                  onChange={(e) => setSwarmNetworkSubnet(e.target.value)}
                  placeholder="10.0.0.0/24"
                  aria-label="Network subnet"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 180 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Gateway</div>
                <input
                  value={swarmNetworkGateway}
                  onChange={(e) => setSwarmNetworkGateway(e.target.value)}
                  placeholder="10.0.0.1"
                  aria-label="Network gateway"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
          {isSwarm && swarmKind === 'volume' && (
            <div style={{ padding: 16, borderBottom: '1px solid #353a42', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>Driver</div>
                <select
                  value={swarmVolumeDriver}
                  onChange={(e) => setSwarmVolumeDriver(e.target.value)}
                  aria-label="Volume driver"
                  style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', boxSizing: 'border-box' }}
                >
                  <option value="local">local</option>
                  <option value="nfs">nfs</option>
                </select>
              </div>
              <div style={{ flex: '2 1 420px', minWidth: 280 }}>
                <KeyValueEditor
                  title="Driver options"
                  rows={swarmVolumeDriverOptRows}
                  onChange={setSwarmVolumeDriverOptRows}
                  keyPlaceholder="o"
                  valuePlaceholder="addr=10.0.0.10,rw"
                  addButtonLabel="Add option"
                  ariaPrefix="Option"
                />
              </div>
            </div>
          )}
          {showSwarmEditor && (
            <div id={isSwarm && swarmKind === 'stack' ? 'swarm-compose-editor' : undefined} ref={editorParentRef} style={{ width: '100%', flex: '1 1 auto', minHeight: 0 }} />
          )}
          {error && (
            <div style={{ position: 'absolute', top: 8, left: 10, color: '#f85149', background: 'rgba(248,81,73,0.1)', padding: '4px 8px', borderRadius: 0, border: '1px solid rgba(248,81,73,0.4)' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #353a42', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ color: '#bbb', fontSize: 12 }}>
            {isSwarm ? (
              <span>Target: <strong style={{ color: '#fff' }}>Docker Swarm</strong></span>
            ) : (
              <span>Namespace: <strong style={{ color: '#fff' }}>{namespace || 'default'}</strong></span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button id={isSwarm ? 'swarm-create-btn' : undefined} onClick={handleCreate} disabled={submitting} style={{ padding: '8px 12px', background: submitting ? '#2ea44f' : '#2ea44f', opacity: submitting ? 0.7 : 1, color: '#fff', border: '1px solid #2ea44f', borderRadius: 0, cursor: submitting ? 'not-allowed' : 'pointer' }}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
