import type React from 'react';
import ClusterOverview from './k8s/cluster/ClusterOverview';
import GraphView from './k8s/graph/GraphView';
import ClusterRoleBindingsOverviewTable from './k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable';
import ClusterRolesOverviewTable from './k8s/resources/clusterroles/ClusterRolesOverviewTable';
import ConfigMapsOverviewTable from './k8s/resources/configmaps/ConfigMapsOverviewTable';
import CronJobsOverviewTable from './k8s/resources/cronjobs/CronJobsOverviewTable';
import DaemonSetsOverviewTable from './k8s/resources/daemonsets/DaemonSetsOverviewTable';
import DeploymentsOverviewTable from './k8s/resources/deployments/DeploymentsOverviewTable';
import HelmReleasesOverviewTable from './k8s/resources/helmreleases/HelmReleasesOverviewTable';
import IngressesOverviewTable from './k8s/resources/ingresses/IngressesOverviewTable';
import JobsOverviewTable from './k8s/resources/jobs/JobsOverviewTable';
import HPAOverviewTable from './k8s/resources/hpa/HPAOverviewTable';
import NodesOverviewTable from './k8s/resources/nodes/NodesOverviewTable';
import PersistentVolumeClaimsOverviewTable from './k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable';
import PersistentVolumesOverviewTable from './k8s/resources/persistentvolumes/PersistentVolumesOverviewTable';
import { renderPodOverviewTable } from './k8s/resources/pods/PodOverviewEntry';
import ReplicaSetsOverviewTable from './k8s/resources/replicasets/ReplicaSetsOverviewTable';
import RoleBindingsOverviewTable from './k8s/resources/rolebindings/RoleBindingsOverviewTable';
import RolesOverviewTable from './k8s/resources/roles/RolesOverviewTable';
import SecretsOverviewTable from './k8s/resources/secrets/SecretsOverviewTable';
import ServicesOverviewTable from './k8s/resources/services/ServicesOverviewTable';
import StatefulSetsOverviewTable from './k8s/resources/statefulsets/StatefulSetsOverviewTable';
import { showResourceOverlay } from './resource-overlay';
// Docker Swarm imports
import { createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import SwarmRegistriesOverview from './docker/registry/SwarmRegistriesOverview';
import SwarmConfigsOverviewTable from './docker/resources/configs/SwarmConfigsOverviewTable';
import SwarmNetworksOverviewTable from './docker/resources/networks/SwarmNetworksOverviewTable';
import SwarmNodesOverviewTable from './docker/resources/nodes/SwarmNodesOverviewTable';
import SwarmSecretsOverviewTable from './docker/resources/secrets/SwarmSecretsOverviewTable';
import SwarmServicesOverviewTable from './docker/resources/services/SwarmServicesOverviewTable';
import SwarmStacksOverviewTable from './docker/resources/stacks/SwarmStacksOverviewTable';
import SwarmTasksOverviewTable from './docker/resources/tasks/SwarmTasksOverviewTable';
import SwarmVolumesOverviewTable from './docker/resources/volumes/SwarmVolumesOverviewTable';
import SwarmOverview from './docker/SwarmOverview';
import SwarmResourceCountsContext, { type SwarmResourceCountsContextValue } from './docker/SwarmResourceCountsContext';
import SwarmStateContext, { type SwarmStateContextValue } from './docker/SwarmStateContext';
import { ClusterStateContext, type ClusterStateContextValue } from './state/ClusterStateContext';
import { ResourceCountsContext } from './state/ResourceCountsContext';

// React roots are bound to a specific DOM container. Recreating containers (via innerHTML)
// or re-calling createRoot causes unmount/remount cycles which show up as visible flicker.
const rootByContainerId = new Map<string, Root>();

function getMainPanelsEl() {
    return document.getElementById('main-panels');
}

function ensurePanelContainer(containerId: string, className = 'main-panel') {
    const mainPanels = getMainPanelsEl();
    if (!mainPanels) return null;
    let el = document.getElementById(containerId);
    if (!el) {
        el = document.createElement('div');
        el.id = containerId;
        el.className = className;
        mainPanels.appendChild(el);
    } else if (className && el.className !== className) {
        el.className = className;
    }
    return el;
}

function showOnlyContainers(visibleId: string, allIds: string[]) {
    for (const id of allIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.style.display = id === visibleId ? '' : 'none';
    }
}

export function renderPodsMainContent(selectedNamespaces: string[]) {
    const firstNs = Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : '';

    const podPanelId = 'pods-main-panel';
    const podInnerId = 'pod-overview-react';

    // Keep a stable panel container to prevent unmount/remount flicker.
    const panel = ensurePanelContainer(podPanelId, 'main-panel main-panel-pods');
    if (!panel) return;

    // Ensure the inner mount point exists.
    let podOverviewContainer = document.getElementById(podInnerId);
    if (!podOverviewContainer) {
        podOverviewContainer = document.createElement('div');
        podOverviewContainer.id = podInnerId;
        podOverviewContainer.style.height = '100%';
        podOverviewContainer.style.minHeight = '0';
        podOverviewContainer.style.display = 'flex';
        podOverviewContainer.style.flexDirection = 'column';
        podOverviewContainer.style.flex = '1';
        panel.appendChild(podOverviewContainer);
    }

    if (podOverviewContainer) {
        renderPodOverviewTable({
            container: podOverviewContainer,
            namespace: firstNs,
            namespaces: selectedNamespaces,
            onCreateResource: (type?: string) => {
                if (type) showResourceOverlay(type);
            }
        });
    }

    // Hide other panels that may exist.
    // We only know about resource containers below, so keep this minimal.
    const mainPanels = getMainPanelsEl();
    if (mainPanels) {
        for (const child of Array.from(mainPanels.children)) {
            if (child instanceof HTMLElement && child.id && child.id !== podPanelId) {
                child.style.display = 'none';
            }
        }
    }
    panel.style.display = '';
}

type SwarmCountsValue = SwarmResourceCountsContextValue;
type ResourceCountsValue = { counts: Record<string, unknown> | null; lastUpdated: number };
type RenderOptions = {
  swarmState?: SwarmStateContextValue | null;
  swarmCounts?: SwarmCountsValue | null;
  clusterState?: ClusterStateContextValue | null;
  resourceCounts?: ResourceCountsValue | null;
};

export function renderResourceMainContent(
    selectedNamespaces: string[],
    selectedSection?: string,
    options: RenderOptions = {}
) {
    const firstNs = Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : '';
    const sections: Array<{ id: string; section: string; element: ReactElement }> = [
        {
            id: 'cluster-overview-react',
            section: 'cluster',
            element: createElement(ClusterOverview, {})
        },
        {
            id: 'namespace-topology-react',
            section: 'namespace-topology',
            element: createElement(GraphView, { mode: 'namespace' })
        },
        {
            id: 'storage-graph-react',
            section: 'storage-graph',
            element: createElement(GraphView, { mode: 'storage' })
        },
        {
            id: 'network-graph-react',
            section: 'network-graph',
            element: createElement(GraphView, { mode: 'network' })
        },
        {
            id: 'rbac-graph-react',
            section: 'rbac-graph',
            element: createElement(GraphView, { mode: 'rbac' })
        },
        {
            id: 'deployments-overview-react',
            section: 'deployments',
            element: createElement(DeploymentsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'services-overview-react',
            section: 'services',
            element: createElement(ServicesOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'jobs-overview-react',
            section: 'jobs',
            element: createElement(JobsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'nodes-overview-react',
            section: 'nodes',
            element: createElement(NodesOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'hpa-overview-react',
            section: 'hpa',
            element: createElement(HPAOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'cronjobs-overview-react',
            section: 'cronjobs',
            element: createElement(CronJobsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'daemonsets-overview-react',
            section: 'daemonsets',
            element: createElement(DaemonSetsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'statefulsets-overview-react',
            section: 'statefulsets',
            element: createElement(StatefulSetsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'replicasets-overview-react',
            section: 'replicasets',
            element: createElement(ReplicaSetsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'configmaps-overview-react',
            section: 'configmaps',
            element: createElement(ConfigMapsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'secrets-overview-react',
            section: 'secrets',
            element: createElement(SecretsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'ingresses-overview-react',
            section: 'ingresses',
            element: createElement(IngressesOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'persistentvolumeclaims-overview-react',
            section: 'persistentvolumeclaims',
            element: createElement(PersistentVolumeClaimsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'persistentvolumes-overview-react',
            section: 'persistentvolumes',
            element: createElement(PersistentVolumesOverviewTable, {})
        },
        {
            id: 'helmreleases-overview-react',
            section: 'helmreleases',
            element: createElement(HelmReleasesOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'roles-overview-react',
            section: 'roles',
            element: createElement(RolesOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'clusterroles-overview-react',
            section: 'clusterroles',
            element: createElement(ClusterRolesOverviewTable, { namespace: firstNs })
        },
        {
            id: 'rolebindings-overview-react',
            section: 'rolebindings',
            element: createElement(RoleBindingsOverviewTable, { namespaces: selectedNamespaces, namespace: firstNs })
        },
        {
            id: 'clusterrolebindings-overview-react',
            section: 'clusterrolebindings',
            element: createElement(ClusterRoleBindingsOverviewTable, { namespace: firstNs })
        },
        // Docker Swarm sections
        {
            id: 'swarm-overview-react',
            section: 'swarm-overview',
            element: createElement(SwarmOverview, {})
        },
        {
            id: 'swarm-metrics-dashboard-react',
            section: 'swarm-metrics',
            element: createElement(SwarmOverview, { initialTab: 'metrics' })
        },
        {
            id: 'swarm-topology-view-react',
            section: 'swarm-topology',
            element: createElement(SwarmOverview, { initialTab: 'topology' })
        },
        {
            id: 'swarm-services-overview-react',
            section: 'swarm-services',
            element: createElement(SwarmServicesOverviewTable, {})
        },
        {
            id: 'swarm-tasks-overview-react',
            section: 'swarm-tasks',
            element: createElement(SwarmTasksOverviewTable, {})
        },
        {
            id: 'swarm-nodes-overview-react',
            section: 'swarm-nodes',
            element: createElement(SwarmNodesOverviewTable, {})
        },
        {
            id: 'swarm-networks-overview-react',
            section: 'swarm-networks',
            element: createElement(SwarmNetworksOverviewTable, {})
        },
        {
            id: 'swarm-configs-overview-react',
            section: 'swarm-configs',
            element: createElement(SwarmConfigsOverviewTable, {})
        },
        {
            id: 'swarm-secrets-overview-react',
            section: 'swarm-secrets',
            element: createElement(SwarmSecretsOverviewTable, {})
        },
        {
            id: 'swarm-stacks-overview-react',
            section: 'swarm-stacks',
            element: createElement(SwarmStacksOverviewTable, {})
        },
        {
            id: 'swarm-volumes-overview-react',
            section: 'swarm-volumes',
            element: createElement(SwarmVolumesOverviewTable, {})
        },
        {
            id: 'swarm-registries-overview-react',
            section: 'swarm-registries',
            element: createElement(SwarmRegistriesOverview, {})
        }
    ];

    const targetSection = selectedSection || 'deployments';

    const allContainerIds = sections.map(s => s.id).concat(['pods-main-panel']);
    const target = sections.find(x => x.section === targetSection);
    if (!target) return;

    const container = ensurePanelContainer(target.id, 'main-panel');
    if (!container) return;
    showOnlyContainers(target.id, allContainerIds);

    let root = rootByContainerId.get(target.id);
    if (!root) {
        root = createRoot(container);
        rootByContainerId.set(target.id, root);
    }

    const baseEl = target.element;

    // NOTE: main-content renders into a separate React root.
    // React context does NOT cross roots, so we explicitly bridge contexts.
    if (target.section?.startsWith('swarm-') && options?.swarmState) {
        const swarmCountsValue = options?.swarmCounts ?? { counts: null, registriesCount: null, lastUpdated: 0, refetch: () => {} };
        root.render(
            createElement(
                SwarmStateContext.Provider,
                { value: options.swarmState },
                createElement(
                    SwarmResourceCountsContext.Provider,
                    { value: swarmCountsValue },
                    baseEl
                )
            )
        );
        return;
    }

    // Bridge K8s contexts (ClusterState + ResourceCounts) for K8s views
    if (options?.clusterState) {
        const rcValue = options?.resourceCounts ?? { counts: null, lastUpdated: 0 };
        root.render(
            createElement(
                ClusterStateContext.Provider,
                { value: options.clusterState },
                createElement(
                    ResourceCountsContext.Provider,
                    { value: rcValue },
                    baseEl
                )
            )
        );
        return;
    }

    root.render(baseEl);
}

