// Color schemes for different resource kinds
export const KIND_COLORS = {
  // Workloads - blue tones
  pod: {
    running: '#4ade80', // green
    pending: '#fbbf24', // yellow
    failed: '#ef4444',  // red
    succeeded: '#22c55e',
    unknown: '#94a3b8'
  },
  deployment: '#3b82f6',
  statefulset: '#2563eb',
  daemonset: '#1d4ed8',
  replicaset: '#60a5fa',
  job: '#8b5cf6',
  cronjob: '#7c3aed',
  horizontalpodautoscaler: '#0ea5e9',
  hpa: '#0ea5e9',

  // Networking - orange tones
  service: '#f97316',
  ingress: '#fb923c',
  networkpolicy: '#6366f1',
  endpoints: '#fdba74',

  // Config - green/red tones
  configmap: '#10b981',
  secret: '#dc2626',
  serviceaccount: '#059669',

  // Storage - teal tones
  persistentvolumeclaim: '#14b8a6',
  pvc: '#14b8a6',
  persistentvolume: '#0d9488',
  pv: '#0d9488',
  storageclass: '#6b7280',

  // RBAC - gold tones
  role: '#f59e0b',
  clusterrole: '#d97706',
  rolebinding: '#fbbf24',
  clusterrolebinding: '#f59e0b',
  user: '#ca8a04',
  group: '#a16207',

  // Infrastructure - gray tones
  node: '#475569',
  namespace: '#64748b',
  external: '#64748b',

  // Default
  default: '#94a3b8'
};

// Node shapes (for future use with custom SVG shapes)
export const NODE_SHAPES = {
  pod: 'circle',
  deployment: 'roundedRect',
  statefulset: 'roundedRect',
  daemonset: 'roundedRect',
  replicaset: 'rect',
  job: 'diamond',
  cronjob: 'diamond',
  horizontalpodautoscaler: 'hexagon',
  hpa: 'hexagon',
  service: 'hexagon',
  ingress: 'pentagon',
  configmap: 'square',
  secret: 'square',
  persistentvolumeclaim: 'cylinder',
  pvc: 'cylinder',
  persistentvolume: 'cylinder',
  pv: 'cylinder',
  storageclass: 'rect',
  node: 'largeRect',
  role: 'shield',
  clusterrole: 'shield',
  rolebinding: 'arrow',
  clusterrolebinding: 'arrow',
  user: 'rect',
  group: 'rect',
  networkpolicy: 'octagon',
  default: 'rect'
};

// Edge styles by type
export const EDGE_STYLES = {
  owns: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#64748b',
    label: 'owns',
    animated: false
  },
  selects: {
    strokeDasharray: '5,5',
    strokeWidth: 2,
    stroke: '#3b82f6',
    label: 'selects',
    animated: false
  },
  mounts: {
    strokeDasharray: '2,2',
    strokeWidth: 2,
    stroke: '#10b981',
    label: 'mounts',
    animated: false
  },
  routes_to: {
    strokeDasharray: '0',
    strokeWidth: 3,
    stroke: '#f97316',
    label: 'routes to',
    animated: true
  },
  bound_to: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#14b8a6',
    label: 'bound to',
    animated: false
  },
  provides: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#6b7280',
    label: 'provides',
    animated: false
  },
  runs_on: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#475569',
    label: 'runs on',
    animated: false
  },
  binds: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#f59e0b',
    label: 'binds',
    animated: false
  },
  scales: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#0ea5e9',
    label: 'scales',
    animated: false
  },
  network_policy: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#6366f1',
    label: 'policy',
    animated: false
  },
  network_policy_ingress: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#10b981',
    label: 'ingress',
    animated: false
  },
  network_policy_egress: {
    strokeDasharray: '0',
    strokeWidth: 2,
    stroke: '#ef4444',
    label: 'egress',
    animated: false
  }
};

// Get color for a node based on kind and status
export function getNodeColor(kind: string, status?: string): string {
  const lowerKind = kind.toLowerCase();

  if (lowerKind === 'pod' && status) {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'running') return KIND_COLORS.pod.running;
    if (lowerStatus === 'pending') return KIND_COLORS.pod.pending;
    if (lowerStatus === 'failed') return KIND_COLORS.pod.failed;
    if (lowerStatus === 'succeeded') return KIND_COLORS.pod.succeeded;
    return KIND_COLORS.pod.unknown;
  }

  const color = KIND_COLORS[lowerKind as keyof typeof KIND_COLORS];
  return typeof color === 'string' ? color : KIND_COLORS.default;
}

// Get edge style for an edge type
export function getEdgeStyle(edgeType: string) {
  return EDGE_STYLES[edgeType as keyof typeof EDGE_STYLES] || {
    strokeDasharray: '0',
    strokeWidth: 1,
    stroke: '#94a3b8',
    label: edgeType,
    animated: false
  };
}

// Resource group colors for legend
export const GROUP_COLORS = {
  workload: '#3b82f6',
  networking: '#f97316',
  config: '#10b981',
  storage: '#14b8a6',
  rbac: '#f59e0b',
  infrastructure: '#475569'
};
