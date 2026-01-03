import {renderPodOverviewTable} from "./k8s/resources/pods/PodOverviewEntry";
import {showResourceOverlay} from "./resource-overlay";
import DeploymentsOverviewTable from "./k8s/resources/deployments/DeploymentsOverviewTable";
import JobsOverviewTable from "./k8s/resources/jobs/JobsOverviewTable";
import CronJobsOverviewTable from "./k8s/resources/cronjobs/CronJobsOverviewTable";
import DaemonSetsOverviewTable from "./k8s/resources/daemonsets/DaemonSetsOverviewTable";
import StatefulSetsOverviewTable from "./k8s/resources/statefulsets/StatefulSetsOverviewTable";
import ReplicaSetsOverviewTable from "./k8s/resources/replicasets/ReplicaSetsOverviewTable";
import ConfigMapsOverviewTable from "./k8s/resources/configmaps/ConfigMapsOverviewTable";
import SecretsOverviewTable from "./k8s/resources/secrets/SecretsOverviewTable";
import IngressesOverviewTable from "./k8s/resources/ingresses/IngressesOverviewTable";
import PersistentVolumeClaimsOverviewTable from "./k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable";
import PersistentVolumesOverviewTable from "./k8s/resources/persistentvolumes/PersistentVolumesOverviewTable";
import HelmReleasesOverviewTable from "./k8s/resources/helmreleases/HelmReleasesOverviewTable";
import {createRoot} from "react-dom/client";
import React from 'react';

export function renderPodsMainContent(selectedNamespaces) {
    const firstNs = Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : '';
    document.getElementById("main-panels").innerHTML = `
      <div class="main-panel main-panel-pods">
        <div id="pod-overview-react"></div>
      </div>
    `;
    const podOverviewContainer = document.getElementById('pod-overview-react');
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
}

export function renderResourceMainContent(selectedNamespaces, selectedSection) {
    const firstNs = Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : '';
    const sections = [
        {
            id: 'deployments-overview-react',
            section: 'deployments',
            table: DeploymentsOverviewTable,
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
        }
    ];

    const targetSection = selectedSection || 'deployments';
    sections.filter(x => x.section === targetSection).forEach((section) => {
        document.getElementById("main-panels").innerHTML = `<div class="main-panel" id="${section.id}"></div>`;
        const container = document.getElementById(section.id);
        if (container) {
            const root = createRoot(container);
            root.render(React.createElement(section.table, section.props));
        }
    })
}
