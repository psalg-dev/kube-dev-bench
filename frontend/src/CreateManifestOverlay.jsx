import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import * as AppAPI from '../wailsjs/go/main/App';

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
    default:
      return `# Unknown kind: ${kind || 'Resource'}\n# Edit as needed\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: example\n  namespace: ${ns}\ndata:\n  key: value\n`;
  }
}

export default function CreateManifestOverlay({ open, kind, namespace, onClose }) {
  const editorParentRef = useRef(null);
  const viewRef = useRef(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const initial = useMemo(() => getDefaultManifest(kind, namespace), [kind, namespace]);

  const cmTheme = useMemo(() => EditorView.theme({
    '&': { backgroundColor: '#0d1117', color: '#c9d1d9' },
    '&.cm-editor': { height: '100%', width: '100%' },
    '.cm-content': { caretColor: '#fff', textAlign: 'left' },
    '.cm-line': { textAlign: 'left' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', lineHeight: '1.45' },
    '.cm-gutters': { background: '#161b22', color: '#8b949e', borderRight: '1px solid #30363d' },
    '.cm-gutterElement': { padding: '0 8px' },
  }, { dark: true }), []);

  const cmExtensions = useMemo(() => [
    cmTheme,
    yamlLang(),
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    keymap.of(foldKeymap),
    syntaxHighlighting(defaultHighlightStyle),
    EditorView.lineWrapping,
  ], [cmTheme]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSubmitting(false);
    setText(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, text, cmExtensions]);

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

  const title = kind ? `New ${kind} manifest` : 'New manifest';

  const getCurrentText = () => (viewRef.current ? viewRef.current.state.doc.toString() : text || '');

  async function handleCreate() {
    try {
      setSubmitting(true);
      setError('');
      const manifest = getCurrentText();
      if (!manifest.trim()) {
        setError('Manifest is empty.');
        setSubmitting(false);
        return;
      }
      const ns = namespace || '';
      await AppAPI.CreateResource(ns, manifest);
      onClose?.();
    } catch (e) {
      setError(e?.message || String(e));
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '70%', maxWidth: 900, height: '75vh', background: 'var(--gh-table-header-bg, #2d323b)', border: '1px solid #353a42', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', color: '#fff', display: 'grid', gridTemplateRows: 'auto 1fr auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #353a42', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{title}</span>
          <button onClick={onClose} aria-label="Close" title="Close" style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 0, position: 'relative' }}>
          <div ref={editorParentRef} style={{ width: '100%', height: '55vh', minHeight: '55vh' }} />
          {error && (
            <div style={{ position: 'absolute', top: 8, left: 10, color: '#f85149', background: 'rgba(248,81,73,0.1)', padding: '4px 8px', borderRadius: 0, border: '1px solid rgba(248,81,73,0.4)' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #353a42', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ color: '#bbb', fontSize: 12 }}>Namespace: <strong style={{ color: '#fff' }}>{namespace || 'default'}</strong></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={submitting} style={{ padding: '8px 12px', background: submitting ? '#2ea44f' : '#2ea44f', opacity: submitting ? 0.7 : 1, color: '#fff', border: '1px solid #2ea44f', borderRadius: 0, cursor: submitting ? 'not-allowed' : 'pointer' }}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
