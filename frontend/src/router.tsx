import { createHashRouter, Navigate } from 'react-router-dom';
import App from './App';

// All valid section keys - used for routing
export const k8sSections = [
  'cluster',
  'namespace-topology',
  'storage-graph',
  'network-graph',
  'rbac-graph',
  'pods',
  'deployments',
  'services',
  'jobs',
  'cronjobs',
  'daemonsets',
  'statefulsets',
  'replicasets',
  'configmaps',
  'secrets',
  'ingresses',
  'persistentvolumeclaims',
  'persistentvolumes',
  'helmreleases',
];

export const swarmSections = [
  'swarm-overview',
  'swarm-services',
  'swarm-tasks',
  'swarm-nodes',
  'swarm-stacks',
  'swarm-networks',
  'swarm-configs',
  'swarm-secrets',
  'swarm-volumes',
  'swarm-registries',
];

export const allSections = [...k8sSections, ...swarmSections];

// Helper to get section from path
export function sectionFromPath(pathname: string) {
  // Remove leading slash
  const section = pathname.replace(/^\//, '');
  if (allSections.includes(section)) {
    return section;
  }
  return 'pods'; // default
}

// Create a single route that handles all sections
// The App component will read the current section from the URL
const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Redirect root to /pods
      { index: true, element: <Navigate to="/pods" replace /> },
      // All K8s sections
      ...k8sSections.map((section) => ({
        path: section,
        element: null, // App handles rendering based on section
      })),
      // All Swarm sections
      ...swarmSections.map((section) => ({
        path: section,
        element: null,
      })),
      // Catch-all redirect to pods
      { path: '*', element: <Navigate to="/pods" replace /> },
    ],
  },
]);

export default router;