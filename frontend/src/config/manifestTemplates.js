/**
 * Default YAML manifest templates for Kubernetes and Docker Swarm resources.
 * Extracted from CreateManifestOverlay to reduce component size and improve maintainability.
 */

/**
 * K8s manifest templates organized by resource kind.
 * Each template is a function that takes the namespace and returns YAML content.
 */
export const k8sManifestTemplates = {
  deployment: (ns) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: ${ns}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
`,

  job: (ns) => `apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  namespace: ${ns}
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: job
        image: busybox
        command: ["sh", "-c", "echo hello; sleep 30"]
  backoffLimit: 2
`,

  cronjob: (ns) => `apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
  namespace: ${ns}
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: cron
            image: busybox
            command: ["sh", "-c", "date; echo Hello from the Kubernetes cluster"]
`,

  daemonset: (ns) => `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-daemonset
  namespace: ${ns}
spec:
  selector:
    matchLabels:
      app: my-daemon
  template:
    metadata:
      labels:
        app: my-daemon
    spec:
      containers:
      - name: daemon
        image: nginx:latest
`,

  statefulset: (ns) => `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-statefulset
  namespace: ${ns}
spec:
  serviceName: "stateful-service"
  replicas: 1
  selector:
    matchLabels:
      app: my-stateful
  template:
    metadata:
      labels:
        app: my-stateful
    spec:
      containers:
      - name: app
        image: nginx:latest
`,

  replicaset: (ns) => `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-replicaset
  namespace: ${ns}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: nginx:latest
`,

  configmap: (ns) => `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: ${ns}
data:
  # Add your configuration key-value pairs below
  # Example file-based config:
  # app.properties: |
  #   key1=value1
  #   key2=value2
  # Example YAML config:
  # config.yaml: |
  #   setting:
  #     enabled: true
  # Simple key-value:
  my-key: my-value
`,

  secret: (ns) => `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: ${ns}
type: Opaque
stringData:
  # plain text values; will be base64-encoded by the API server
  username: user
  password: pass
`,

  ingress: (ns) => `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: ${ns}
  annotations:
    kubernetes.io/ingress.class: nginx
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
  # tls:
  # - hosts:
  #   - example.com
  #   secretName: example-tls
`,

  persistentvolumeclaim: (ns) => `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: ${ns}
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
  #     type: local
`,

  // PersistentVolume is cluster-scoped; no namespace field
  persistentvolume: () => `apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
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
  #   fsType: ext4
`,
};

/**
 * Docker Swarm resource default payloads.
 */
export const swarmDefaultPayloads = {
  config: {
    name: 'my-config',
    data: '# Example Swarm config\nKEY=value\n',
    labels: {},
    editorMode: 'text',
  },
  secret: {
    name: 'my-secret',
    data: 'supersecret',
    labels: {},
    editorMode: 'text',
  },
  // Note: 'name' field is used in the form input, while 'data' YAML contains the same 
  // default name for the editor preview. Both are intentionally duplicated as they 
  // serve different UI purposes (form field vs. YAML editor content).
  service: {
    name: 'my-service',
    data: `name: my-service
image: nginx:latest
mode: replicated
replicas: 1
ports:
  # - protocol: tcp
  #   targetPort: 80
  #   publishedPort: 8080
  #   publishMode: ingress
env:
  # KEY: value
labels:
  # com.example.label: value
`,
    labels: {},
    editorMode: 'yaml',
  },
  stack: {
    name: 'my-stack',
    data: `version: "3.8"
services:
  web:
    image: nginx:latest
    deploy:
      replicas: 1
    # Avoid publishing fixed host ports by default (they can conflict locally).
    # ports:
    #   - "8080:80"
`,
    labels: {},
    editorMode: 'yaml',
  },
};

/**
 * Get the default K8s manifest for a given kind.
 * 
 * @param {string} kind - Resource kind (e.g., 'Deployment', 'Service')
 * @param {string} namespace - Target namespace
 * @returns {string} - YAML manifest content
 */
export function getDefaultManifest(kind, namespace) {
  const ns = namespace || 'default';
  const key = (kind || '').toLowerCase();
  
  if (k8sManifestTemplates[key]) {
    return k8sManifestTemplates[key](ns);
  }
  
  // Fallback for unknown kinds
  return `# Unknown kind: ${kind || 'Resource'}
# Edit as needed
apiVersion: v1
kind: ConfigMap
metadata:
  name: example
  namespace: ${ns}
data:
  key: value
`;
}

/**
 * Normalize Swarm kind to singular form.
 * 
 * @param {string} kind - Raw kind string
 * @returns {string} - Normalized kind
 */
export function normalizeSwarmKind(kind) {
  const k = (kind || '').toString().trim().toLowerCase();
  // Allow both singular and plural forms from callers
  if (k.endsWith('s')) {
    const singular = k.slice(0, -1);
    if (['service', 'task', 'node', 'network', 'config', 'secret', 'stack', 'volume'].includes(singular)) {
      return singular;
    }
  }
  return k;
}

/**
 * Get the default Swarm resource payload for a given kind.
 * 
 * @param {string} kind - Resource kind (e.g., 'service', 'config')
 * @returns {Object} - Default payload with name, data, labels, editorMode
 */
export function getDefaultSwarmPayload(kind) {
  const normalized = normalizeSwarmKind(kind);
  
  if (swarmDefaultPayloads[normalized]) {
    return { ...swarmDefaultPayloads[normalized] };
  }
  
  // Fallback
  return {
    name: '',
    data: '',
    labels: {},
    editorMode: 'text',
  };
}

export default {
  k8sManifestTemplates,
  swarmDefaultPayloads,
  getDefaultManifest,
  getDefaultSwarmPayload,
  normalizeSwarmKind,
};
