import {renderPodOverviewTable} from './k8s/resources/pods/PodOverviewEntry';
import {showResourceOverlay} from './resource-overlay.js';
import DeploymentsOverviewTable from './k8s/resources/deployments/DeploymentsOverviewTable';
import ServicesOverviewTable from './k8s/resources/services/ServicesOverviewTable';
import JobsOverviewTable from './k8s/resources/jobs/JobsOverviewTable';
import CronJobsOverviewTable from './k8s/resources/cronjobs/CronJobsOverviewTable';
import DaemonSetsOverviewTable from './k8s/resources/daemonsets/DaemonSetsOverviewTable';
import StatefulSetsOverviewTable from './k8s/resources/statefulsets/StatefulSetsOverviewTable';
import ReplicaSetsOverviewTable from './k8s/resources/replicasets/ReplicaSetsOverviewTable';
import ConfigMapsOverviewTable from './k8s/resources/configmaps/ConfigMapsOverviewTable';
import SecretsOverviewTable from './k8s/resources/secrets/SecretsOverviewTable';
import IngressesOverviewTable from './k8s/resources/ingresses/IngressesOverviewTable';
import PersistentVolumeClaimsOverviewTable from './k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable';
import PersistentVolumesOverviewTable from './k8s/resources/persistentvolumes/PersistentVolumesOverviewTable';
import HelmReleasesOverviewTable from './k8s/resources/helmreleases/HelmReleasesOverviewTable';
// Docker Swarm imports
import SwarmServicesOverviewTable from './docker/resources/services/SwarmServicesOverviewTable';
import SwarmTasksOverviewTable from './docker/resources/tasks/SwarmTasksOverviewTable';
import SwarmNodesOverviewTable from './docker/resources/nodes/SwarmNodesOverviewTable';
import SwarmNetworksOverviewTable from './docker/resources/networks/SwarmNetworksOverviewTable';
import SwarmConfigsOverviewTable from './docker/resources/configs/SwarmConfigsOverviewTable';
import SwarmSecretsOverviewTable from './docker/resources/secrets/SwarmSecretsOverviewTable';
import SwarmStacksOverviewTable from './docker/resources/stacks/SwarmStacksOverviewTable';
import SwarmVolumesOverviewTable from './docker/resources/volumes/SwarmVolumesOverviewTable';
import SwarmRegistriesOverview from './docker/registry/SwarmRegistriesOverview.jsx';
import SwarmOverview from './docker/SwarmOverview.jsx';
import SwarmStateContext from './docker/SwarmStateContext.jsx';
import SwarmResourceCountsContext from './docker/SwarmResourceCountsContext.jsx';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

// React roots are bound to a specific DOM container. Recreating containers (via innerHTML)
// or re-calling createRoot causes unmount/remount cycles which show up as visible flicker.
const rootByContainerId = new Map();

function getMainPanelsEl() {
    return document.getElementById('main-panels');
}

function ensurePanelContainer(containerId, className = 'main-panel') {
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

function showOnlyContainers(visibleId, allIds) {
    for (const id of allIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.style.display = id === visibleId ? '' : 'none';
    }
}

export function renderPodsMainContent(selectedNamespaces) {
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
        panel.appendChild(podOverviewContainer);
    }

    if (podOverviewContainer) {
        renderPodOverviewTable({
            container: podOverviewContainer,
            namespace: firstNs,
            namespaces: selectedNamespaces,
            onCreateResource: (type) => {
                showResourceOverlay(type);
            }
        });
    }

    // Hide other panels that may exist.
    // We only know about resource containers below, so keep this minimal.
    const mainPanels = getMainPanelsEl();
    if (mainPanels) {
        for (const child of Array.from(mainPanels.children)) {
            if (child?.id && child.id !== podPanelId) child.style.display = 'none';
        }
    }
    panel.style.display = '';
}

export function renderResourceMainContent(selectedNamespaces, selectedSection, options = {}) {
    const firstNs = Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : '';
    const sections = [
        {
            id: 'deployments-overview-react',
            section: 'deployments',
            table: DeploymentsOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'services-overview-react',
            section: 'services',
            table: ServicesOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'jobs-overview-react',
            section: 'jobs',
            table: JobsOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'cronjobs-overview-react',
            section: 'cronjobs',
            table: CronJobsOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'daemonsets-overview-react',
            section: 'daemonsets',
            table: DaemonSetsOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'statefulsets-overview-react',
            section: 'statefulsets',
            table: StatefulSetsOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'replicasets-overview-react',
            section: 'replicasets',
            table: ReplicaSetsOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        {
            id: 'configmaps-overview-react',
            section: 'configmaps',
            table: ConfigMapsOverviewTable,
            props: {
                namespaces: selectedNamespaces,
                namespace: firstNs,
                onConfigMapCreate: () => {
                    showResourceOverlay('configmap');
                }
            }
        },
        {
            id: 'secrets-overview-react',
            section: 'secrets',
            table: SecretsOverviewTable,
            props: {
                namespaces: selectedNamespaces,
                namespace: firstNs,
                onSecretCreate: () => {
                    showResourceOverlay('secret');
                }
            }
        },
        {
            id: 'ingresses-overview-react',
            section: 'ingresses',
            table: IngressesOverviewTable,
            props: {
                namespaces: selectedNamespaces,
                namespace: firstNs,
                onIngressCreate: () => {
                    showResourceOverlay('ingress');
                }
            }
        },
        {
            id: 'persistentvolumeclaims-overview-react',
            section: 'persistentvolumeclaims',
            table: PersistentVolumeClaimsOverviewTable,
            props: {
                namespaces: selectedNamespaces,
                namespace: firstNs,
                onIngressCreate: () => {
                    showResourceOverlay('persistentvolumeclaim');
                }
            }
        },
        {
            id: 'persistentvolumes-overview-react',
            section: 'persistentvolumes',
            table: PersistentVolumesOverviewTable,
            props: {namespace: firstNs}
        },
        {
            id: 'helmreleases-overview-react',
            section: 'helmreleases',
            table: HelmReleasesOverviewTable,
            props: {namespaces: selectedNamespaces, namespace: firstNs}
        },
        // Docker Swarm sections
        {
            id: 'swarm-overview-react',
            section: 'swarm-overview',
            table: SwarmOverview,
            props: {}
        },
        {
            id: 'swarm-metrics-dashboard-react',
            section: 'swarm-metrics',
            table: SwarmOverview,
            props: { initialTab: 'metrics' }
        },
        {
            id: 'swarm-topology-view-react',
            section: 'swarm-topology',
            table: SwarmOverview,
            props: { initialTab: 'topology' }
        },
        {
            id: 'swarm-services-overview-react',
            section: 'swarm-services',
            table: SwarmServicesOverviewTable,
            props: {}
        },
        {
            id: 'swarm-tasks-overview-react',
            section: 'swarm-tasks',
            table: SwarmTasksOverviewTable,
            props: {}
        },
        {
            id: 'swarm-nodes-overview-react',
            section: 'swarm-nodes',
            table: SwarmNodesOverviewTable,
            props: {}
        },
        {
            id: 'swarm-networks-overview-react',
            section: 'swarm-networks',
            table: SwarmNetworksOverviewTable,
            props: {}
        },
        {
            id: 'swarm-configs-overview-react',
            section: 'swarm-configs',
            table: SwarmConfigsOverviewTable,
            props: {}
        },
        {
            id: 'swarm-secrets-overview-react',
            section: 'swarm-secrets',
            table: SwarmSecretsOverviewTable,
            props: {}
        },
        {
            id: 'swarm-stacks-overview-react',
            section: 'swarm-stacks',
            table: SwarmStacksOverviewTable,
            props: {}
        },
        {
            id: 'swarm-volumes-overview-react',
            section: 'swarm-volumes',
            table: SwarmVolumesOverviewTable,
            props: {}
        },
        {
            id: 'swarm-registries-overview-react',
            section: 'swarm-registries',
            table: SwarmRegistriesOverview,
            props: {}
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

    const baseEl = createElement(target.table, target.props);

    // NOTE: main-content.js renders into a separate React root.
    // React context does NOT cross roots, so we explicitly bridge Swarm contexts
    // for Swarm-related views.
    if (target.section?.startsWith('swarm-') && options?.swarmState) {
        const swarmCountsValue = options?.swarmCounts ?? { counts: null, lastUpdated: 0, refetch: () => {} };
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

    root.render(baseEl);
}
