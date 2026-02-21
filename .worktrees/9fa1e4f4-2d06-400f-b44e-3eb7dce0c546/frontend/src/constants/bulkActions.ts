export type BulkAction = {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  confirm?: boolean;
  promptReplicas?: boolean;
  disabled?: boolean;
  title?: string;
};

type BulkActionMap = Record<string, BulkAction[]>;

const K8S_BULK_ACTIONS: BulkActionMap = {
  deployment: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  statefulset: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  daemonset: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
  ],
  replicaset: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  pod: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
  ],
  cronjob: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
    { key: 'suspend', label: 'Suspend', icon: '⏸️' },
    { key: 'resume', label: 'Resume', icon: '▶️' },
  ],
  job: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  configmap: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  secret: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  pvc: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  pv: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  ingress: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  service: [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true, confirm: true },
  ],
  helmrelease: [
    { key: 'delete', label: 'Uninstall', icon: '🗑️', danger: true, confirm: true },
  ],
};

const SWARM_BULK_ACTIONS: BulkActionMap = {
  service: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
    { key: 'scale', label: 'Scale', icon: '📏', promptReplicas: true },
  ],
  task: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true, disabled: true, title: 'Bulk remove is not supported for Swarm tasks.' },
  ],
  node: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
    { key: 'drain', label: 'Drain', icon: '🛑' },
    { key: 'pause', label: 'Pause', icon: '⏸️' },
    { key: 'activate', label: 'Activate', icon: '✅' },
  ],
  network: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
  ],
  config: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
  ],
  secret: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
  ],
  volume: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
  ],
  stack: [
    { key: 'delete', label: 'Remove', icon: '🗑️', danger: true, confirm: true },
  ],
};

const KIND_ALIASES: Record<string, string> = {
  deployment: 'deployment',
  deployments: 'deployment',
  statefulset: 'statefulset',
  statefulsets: 'statefulset',
  daemonset: 'daemonset',
  daemonsets: 'daemonset',
  replicaset: 'replicaset',
  replicasets: 'replicaset',
  pod: 'pod',
  pods: 'pod',
  cronjob: 'cronjob',
  cronjobs: 'cronjob',
  job: 'job',
  jobs: 'job',
  configmap: 'configmap',
  configmaps: 'configmap',
  secret: 'secret',
  secrets: 'secret',
  persistentvolumeclaim: 'pvc',
  persistentvolumeclaims: 'pvc',
  pvc: 'pvc',
  persistentvolume: 'pv',
  persistentvolumes: 'pv',
  pv: 'pv',
  ingress: 'ingress',
  ingresses: 'ingress',
  service: 'service',
  services: 'service',
  helmrelease: 'helmrelease',
  helmreleases: 'helmrelease',
};

const SWARM_KIND_ALIASES: Record<string, string> = {
  service: 'service',
  services: 'service',
  task: 'task',
  tasks: 'task',
  node: 'node',
  nodes: 'node',
  network: 'network',
  networks: 'network',
  config: 'config',
  configs: 'config',
  secret: 'secret',
  secrets: 'secret',
  volume: 'volume',
  volumes: 'volume',
  stack: 'stack',
  stacks: 'stack',
};

export function normalizeBulkKind(kind?: string, platform: 'k8s' | 'swarm' = 'k8s') {
  const raw = String(kind || '').trim().toLowerCase();
  if (!raw) return '';
  if (platform === 'swarm') {
    return SWARM_KIND_ALIASES[raw] || raw;
  }
  return KIND_ALIASES[raw] || raw;
}

export function getBulkActionsForResource({ platform = 'k8s', kind }: { platform?: 'k8s' | 'swarm'; kind?: string }): BulkAction[] {
  const normalized = normalizeBulkKind(kind, platform);
  if (!normalized) return [];
  if (platform === 'swarm') {
    return SWARM_BULK_ACTIONS[normalized] || [];
  }
  return K8S_BULK_ACTIONS[normalized] || [];
}
