import {getSelectedSection} from "./sidebar";
import {renderPodOverviewTable} from "./pods/PodOverviewEntry";
import {showResourceOverlay} from "./resource-overlay";
import DeploymentsOverviewTable from "./deployments/DeploymentsOverviewTable";
import JobsOverviewTable from "./jobs/JobsOverviewTable";
import CronJobsOverviewTable from "./cronjobs/CronJobsOverviewTable";
import DaemonSetsOverviewTable from "./daemonsets/DaemonSetsOverviewTable";
import StatefulSetsOverviewTable from "./statefulsets/StatefulSetsOverviewTable";
import ReplicaSetsOverviewTable from "./replicasets/ReplicaSetsOverviewTable";
import ConfigMapsOverviewTable from "./configmaps/ConfigMapsOverviewTable";
import SecretsOverviewTable from "./secrets/SecretsOverviewTable";
import IngressesOverviewTable from "./ingresses/IngressesOverviewTable";
import PersistentVolumeClaimsOverviewTable from "./persistentvolumeclaims/PersistentVolumeClaimsOverviewTable";
import PersistentVolumesOverviewTable from "./persistentvolumes/PersistentVolumesOverviewTable";
import {createRoot} from "react-dom/client";
import React from 'react';

export function renderPodsMainContent(selectedNamespace) {
    document.getElementById("main-panels").innerHTML = `
      <div class="main-panel main-panel-pods">
        <div id="pod-overview-react"></div>
      </div>
    `;
    const podOverviewContainer = document.getElementById('pod-overview-react');
    if (podOverviewContainer) {
        renderPodOverviewTable({
            container: podOverviewContainer,
            namespace: selectedNamespace,
            onCreateResource: (type) => {
                showResourceOverlay(type);
            }
        });
    }
}

export function renderResourceMainContent(selectedNamespace) {
    const sections = [
        {
            id: 'deployments-overview-react',
            section: 'deployments',
            table: DeploymentsOverviewTable,
            props: {namespace: selectedNamespace}
        },
        {
            id: 'jobs-overview-react',
            section: 'jobs',
            table: JobsOverviewTable,
            props: {namespace: selectedNamespace}
        },
        {
            id: 'cronjobs-overview-react',
            section: 'cronjobs',
            table: CronJobsOverviewTable,
            props: {namespace: selectedNamespace}
        },
        {
            id: 'daemonsets-overview-react',
            section: 'daemonsets',
            table: DaemonSetsOverviewTable,
            props: {namespace: selectedNamespace}
        },
        {
            id: 'statefulsets-overview-react',
            section: 'statefulsets',
            table: StatefulSetsOverviewTable,
            props: {namespace: selectedNamespace}
        },
        {
            id: 'replicasets-overview-react',
            section: 'replicasets',
            table: ReplicaSetsOverviewTable,
            props: {namespace: selectedNamespace}
        },
        {
            id: 'configmaps-overview-react',
            section: 'configmaps',
            table: ConfigMapsOverviewTable,
            props: {
                namespace: selectedNamespace,
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
                namespace: selectedNamespace,
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
                namespace: selectedNamespace,
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
                namespace: selectedNamespace,
                onIngressCreate: () => {
                    showResourceOverlay('persistentvolumeclaim');
                }
            }
        },
        {
            id: 'persistentvolumes-overview-react',
            section: 'persistentvolumes',
            table: PersistentVolumesOverviewTable,
            props: {namespace: selectedNamespace}
        }
    ];

    sections.filter(x => x.section === getSelectedSection()).forEach((section) => {
        document.getElementById("main-panels").innerHTML = `<div class="main-panel" id="${section.id}"></div>`;
        const container = document.getElementById(section.id);
        if (container) {
            const root = createRoot(container);
            root.render(React.createElement(section.table, section.props));
        }
    })
}
