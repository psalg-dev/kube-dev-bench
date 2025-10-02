import {EditorState} from "@codemirror/state";
import {
    crosshairCursor,
    drawSelection, dropCursor,
    highlightActiveLine, highlightActiveLineGutter,
    highlightSpecialChars, keymap,
    lineNumbers, rectangularSelection
} from "@codemirror/view";
import { EditorView } from "@codemirror/view";
import {
    bracketMatching,
    defaultHighlightStyle,
    foldGutter, foldKeymap,
    indentOnInput,
    syntaxHighlighting
} from "@codemirror/language";
import {highlightSelectionMatches, searchKeymap} from "@codemirror/search";
import {yaml} from "@codemirror/lang-yaml";
import {closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete";
import {defaultKeymap, history, historyKeymap} from "@codemirror/commands";
import {lintKeymap} from "@codemirror/lint";
import { CreateResource } from "../wailsjs/go/main/App";

export function showResourceOverlay(resourceType, options = {}) {
    console.log('showResourceOverlay called with:', resourceType);
    const template = resourceTemplates[resourceType];
    console.log('Template found:', template ? 'yes' : 'no');
    if (!template) {
        console.error('No template found for resource type:', resourceType);
        console.log('Available templates:', Object.keys(resourceTemplates));
        return;
    }

    const { onSuccess, onError, onClose, namespace } = options;
    const title = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
    <div class="overlay-content">
      <div class="overlay-header">
        <div class="overlay-title">New ${title} Resource</div>
        <button class="overlay-close">×</button>
      </div>
      <div id="resourceEditor" class="editor-wrapper"></div>
      <div style="display:flex;justify-content:flex-end;gap:1rem;margin-top:1.5rem;">
        <button class="overlay-cancel-btn">Cancel</button>
        <button class="overlay-create-btn" style="background:var(--gh-accent);color:#fff;border:none;padding:0.5em 1.5em;border-radius:6px;cursor:pointer;font-weight:600;">Create</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Initialize CodeMirror editor
    const customDarkTheme = EditorView.theme({
        "&": { color: "var(--gh-text)", backgroundColor: "var(--gh-input-bg)", height: "400px", fontSize: "14px" },
        ".cm-content": { fontFamily: "'Consolas', monospace", color: "var(--gh-text)", padding: "10px" },
        ".cm-gutters": { backgroundColor: "var(--gh-input-bg)", color: "var(--gh-text-muted)", border: "none" }
    }, {dark: true});

    const state = EditorState.create({
        doc: template,
        extensions: [
            lineNumbers(), foldGutter(), highlightSpecialChars(), drawSelection(),
            dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }), bracketMatching(),
            rectangularSelection(), crosshairCursor(), highlightActiveLine(),
            highlightActiveLineGutter(), highlightSelectionMatches(), yaml(), customDarkTheme,
            keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap])
        ]
    });

    const editor = new EditorView({
        state,
        parent: document.querySelector("#resourceEditor")
    });

    const closeOverlay = () => {
        editor.destroy();
        overlay.remove();
        if (onClose) onClose();
    };

    // Close overlay handlers
    const closeBtn = overlay.querySelector('.overlay-close');
    const cancelBtn = overlay.querySelector('.overlay-cancel-btn');
    closeBtn.onclick = cancelBtn.onclick = closeOverlay;

    // Create resource handler
    const createBtn = overlay.querySelector('.overlay-create-btn');
    createBtn.onclick = async () => {
        const yaml = editor.state.doc.toString();
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        try {
            await CreateResource(namespace || 'default', yaml);
            showMessage(`${title} was created successfully!`, 'success');
            closeOverlay();
            if (onSuccess) onSuccess();
        } catch (err) {
            showMessage(`Error creating resource: ${err}`, 'error');
            createBtn.disabled = false;
            createBtn.textContent = 'Create';
            if (onError) onError(err);
        }
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeOverlay();
        }
    };
}

// Simple message function
function showMessage(message, type = 'error') {
    // Create a simple message display
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        ${type === 'success' ? 'background: #28a745;' : 'background: #dc3545;'}
    `;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 5000);
}


// Resource templates
const resourceTemplates = {
    deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80`,

    job: `apiVersion: batch/v1
kind: Job
metadata:
  name: busybox-job
spec:
  template:
    spec:
      containers:
      - name: busybox
        image: busybox
        command: ["sh", "-c", "echo Hello Kubernetes! && sleep 30"]
      restartPolicy: Never
  backoffLimit: 4`,

    configmap: `apiVersion: v1
kind: ConfigMap
metadata:
  name: example-config
data:
  # Configuration data as key-value pairs
  app.properties: |
    debug=true
    database.host=localhost
    database.port=5432
  config.yaml: |
    server:
      port: 8080
      host: 0.0.0.0
    logging:
      level: info
  simple-key: simple-value`,

    secret: `apiVersion: v1
kind: Secret
metadata:
  name: example-secret
type: Opaque
data:
  # Secret data must be base64 encoded
  # Use: echo -n "your-value" | base64
  username: dXNlcm5hbWU=  # username
  password: cGFzc3dvcmQ=  # password
stringData:
  # Alternative: use stringData for plain text (will be auto-encoded)
  # api-key: your-api-key-here
  # database-url: postgresql://user:pass@localhost:5432/db`,

    ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    # nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: example-service
            port:
              number: 80
  # Optional: TLS configuration
  # tls:
  # - hosts:
  #   - example.com
  #   secretName: example-tls-secret`,

    persistentvolumeclaim: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: example-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  # Optional: specify storage class
  # storageClassName: fast-ssd
  # Optional: selector for existing PV
  # selector:
  #   matchLabels:
  #     type: local`,

    persistentvolume: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv
  labels:
    type: local
spec:
  storageClassName: manual
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: "/mnt/data"
  # Alternative volume sources:
  # nfs:
  #   server: nfs-server.example.com
  #   path: /path/to/nfs/share
  # awsElasticBlockStore:
  #   volumeID: vol-12345678
  #   fsType: ext4
  # gcePersistentDisk:
  #   pdName: my-data-disk
  #   fsType: ext4`
};
