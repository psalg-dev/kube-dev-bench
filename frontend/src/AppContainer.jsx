import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ClusterStateProvider, useClusterState } from './state/ClusterStateContext.jsx';
import { AppLayout } from './layout/AppLayout.jsx';
import ConnectionWizard from './layout/connection/ConnectionWizard.jsx';
import { ContextSelect, NamespaceMultiSelect } from './Dropdowns.jsx';
import { ResourceCountsProvider } from './state/ResourceCountsContext.jsx';
// Docker Swarm providers
import { SwarmStateProvider, useSwarmState } from './docker/SwarmStateContext.jsx';
import { SwarmResourceCountsProvider } from './docker/SwarmResourceCountsContext.jsx';
import SwarmConnectionWizard from './docker/SwarmConnectionWizard.jsx';
// Resource overview tables
import PodOverviewTable from './k8s/resources/pods/PodOverviewTable.jsx';
import DeploymentsOverviewTable from './k8s/resources/deployments/DeploymentsOverviewTable.jsx';
import JobsOverviewTable from './k8s/resources/jobs/JobsOverviewTable.jsx';
import CronJobsOverviewTable from './k8s/resources/cronjobs/CronJobsOverviewTable.jsx';
import DaemonSetsOverviewTable from './k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx';
import StatefulSetsOverviewTable from './k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx';
import ReplicaSetsOverviewTable from './k8s/resources/replicasets/ReplicaSetsOverviewTable.jsx';
import ConfigMapsOverviewTable from './k8s/resources/configmaps/ConfigMapsOverviewTable.jsx';
import SecretsOverviewTable from './k8s/resources/secrets/SecretsOverviewTable.jsx';
import IngressesOverviewTable from './k8s/resources/ingresses/IngressesOverviewTable.jsx';
import PersistentVolumeClaimsOverviewTable from './k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx';
import PersistentVolumesOverviewTable from './k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx';
import HelmReleasesOverviewTable from './k8s/resources/helmreleases/HelmReleasesOverviewTable.jsx';
import HelmInstallDialog from './k8s/resources/helmreleases/HelmInstallDialog.jsx';
import HelmRepositoriesDialog from './k8s/resources/helmreleases/HelmRepositoriesDialog.jsx';
// Docker Swarm resource views
import SwarmServicesOverviewTable from './docker/resources/services/SwarmServicesOverviewTable.jsx';
import SwarmTasksOverviewTable from './docker/resources/tasks/SwarmTasksOverviewTable.jsx';
import SwarmNodesOverviewTable from './docker/resources/nodes/SwarmNodesOverviewTable.jsx';
import SwarmNetworksOverviewTable from './docker/resources/networks/SwarmNetworksOverviewTable.jsx';
import SwarmConfigsOverviewTable from './docker/resources/configs/SwarmConfigsOverviewTable.jsx';
import SwarmSecretsOverviewTable from './docker/resources/secrets/SwarmSecretsOverviewTable.jsx';
import SwarmStacksOverviewTable from './docker/resources/stacks/SwarmStacksOverviewTable.jsx';
import SwarmVolumesOverviewTable from './docker/resources/volumes/SwarmVolumesOverviewTable.jsx';
import { showResourceOverlay } from './resource-overlay.js';

function MainApp({ selectedSection, setSelectedSection }) {
  const { showWizard, actions, contexts, namespaces, selectedContext, selectedNamespaces, contextDisabled, namespaceDisabled } = useClusterState();
  const swarmState = useSwarmState();
  const firstNs = useMemo(() => (Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : ''), [selectedNamespaces]);
  const [showHelmInstall, setShowHelmInstall] = useState(false);
  const [showHelmRepos, setShowHelmRepos] = useState(false);

  // Global hotkey & sidebar toggle
  useEffect(() => {
    if (showWizard) return;
    const keyHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); actions.openWizard(); }
    };
    document.addEventListener('keydown', keyHandler);
    const wizardBtn = document.getElementById('show-wizard-btn');
    if (wizardBtn) wizardBtn.onclick = () => actions.openWizard();
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) toggleBtn.onclick = () => {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return; sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      toggleBtn.innerHTML = collapsed ? '<span>▶</span><span>Show Sidebar</span>' : '<span>◀</span><span>Hide Sidebar</span>';
    };
    return () => {
      document.removeEventListener('keydown', keyHandler);
      if (wizardBtn) wizardBtn.onclick = null;
      if (toggleBtn) toggleBtn.onclick = null;
    };
  }, [showWizard, actions]);

  // Map selectedSection -> component
  const mainContentEl = useMemo(() => {
    if (showWizard) return null;
    const commonNsProps = { namespaces: selectedNamespaces, namespace: firstNs };
    switch (selectedSection) {
      case 'pods':
        return <PodOverviewTable namespace={firstNs} namespaces={selectedNamespaces} onCreateResource={(type)=>showResourceOverlay(type)} />;
      case 'deployments':
        return <DeploymentsOverviewTable {...commonNsProps} />;
      case 'jobs':
        return <JobsOverviewTable {...commonNsProps} />;
      case 'cronjobs':
        return <CronJobsOverviewTable {...commonNsProps} />;
      case 'daemonsets':
        return <DaemonSetsOverviewTable {...commonNsProps} />;
      case 'statefulsets':
        return <StatefulSetsOverviewTable {...commonNsProps} />;
      case 'replicasets':
        return <ReplicaSetsOverviewTable {...commonNsProps} />;
      case 'configmaps':
        return <ConfigMapsOverviewTable {...commonNsProps} onConfigMapCreate={()=>showResourceOverlay('configmap')} />;
      case 'secrets':
        return <SecretsOverviewTable {...commonNsProps} onSecretCreate={()=>showResourceOverlay('secret')} />;
      case 'ingresses':
        return <IngressesOverviewTable {...commonNsProps} onIngressCreate={()=>showResourceOverlay('ingress')} />;
      case 'persistentvolumeclaims':
        return <PersistentVolumeClaimsOverviewTable {...commonNsProps} onIngressCreate={()=>showResourceOverlay('persistentvolumeclaim')} />;
      case 'persistentvolumes':
        return <PersistentVolumesOverviewTable namespace={firstNs} />;
      case 'helmreleases':
        return <HelmReleasesOverviewTable {...commonNsProps} />;
      // Docker Swarm views
      case 'swarm-services':
        return <SwarmServicesOverviewTable />;
      case 'swarm-tasks':
        return <SwarmTasksOverviewTable />;
      case 'swarm-nodes':
        return <SwarmNodesOverviewTable />;
      case 'swarm-networks':
        return <SwarmNetworksOverviewTable />;
      case 'swarm-configs':
        return <SwarmConfigsOverviewTable />;
      case 'swarm-secrets':
        return <SwarmSecretsOverviewTable />;
      case 'swarm-stacks':
        return <SwarmStacksOverviewTable />;
      case 'swarm-volumes':
        return <SwarmVolumesOverviewTable />;
      default:
        return null;
    }
  }, [selectedSection, selectedNamespaces, firstNs, showWizard]);

  const renderPodsMainContent = useCallback(
    (selectedNamespaces) => {
      return <PodOverviewTable namespace={firstNs} namespaces={selectedNamespaces} onCreateResource={(type)=>showResourceOverlay(type)} />;
    },
    [firstNs]
  );

  const renderResourceMainContent = useCallback(
    (selectedNamespaces, selectedSection) => {
      const commonNsProps = { namespaces: selectedNamespaces, namespace: firstNs };
      switch (selectedSection) {
        case 'deployments':
          return <DeploymentsOverviewTable {...commonNsProps} />;
        case 'jobs':
          return <JobsOverviewTable {...commonNsProps} />;
        case 'cronjobs':
          return <CronJobsOverviewTable {...commonNsProps} />;
        case 'daemonsets':
          return <DaemonSetsOverviewTable {...commonNsProps} />;
        case 'statefulsets':
          return <StatefulSetsOverviewTable {...commonNsProps} />;
        case 'replicasets':
          return <ReplicaSetsOverviewTable {...commonNsProps} />;
        case 'configmaps':
          return <ConfigMapsOverviewTable {...commonNsProps} onConfigMapCreate={()=>showResourceOverlay('configmap')} />;
        case 'secrets':
          return <SecretsOverviewTable {...commonNsProps} onSecretCreate={()=>showResourceOverlay('secret')} />;
        case 'ingresses':
          return <IngressesOverviewTable {...commonNsProps} onIngressCreate={()=>showResourceOverlay('ingress')} />;
        case 'persistentvolumeclaims':
          return <PersistentVolumeClaimsOverviewTable {...commonNsProps} onIngressCreate={()=>showResourceOverlay('persistentvolumeclaim')} />;
        case 'persistentvolumes':
          return <PersistentVolumesOverviewTable namespace={firstNs} />;
        case 'helmreleases':
          return <HelmReleasesOverviewTable {...commonNsProps} />;
        default:
          return null;
      }
    },
    [firstNs]
  );

  const handleSelectSection = (section) => {
    setSelectedSection(section);
  };

  if (showWizard) {
    return <ConnectionWizard onComplete={() => actions.closeWizard()} />;
  }

  return (
    <>
      <AppLayout
        contextSelectEl={<ContextSelect
          value={selectedContext}
          options={contexts}
          disabled={contextDisabled}
          onChange={(v) => actions.selectContext(v)}
          onMenuOpen={() => actions.reloadContexts()}
        />}
        namespaceSelectEl={<NamespaceMultiSelect
          values={selectedNamespaces}
          options={namespaces}
          disabled={namespaceDisabled}
          onChange={(vals) => actions.selectNamespaces(vals)}
          onMenuOpen={() => actions.reloadNamespaces()}
        />}
        selectedSection={selectedSection}
        onSelectSection={handleSelectSection}
        mainContentEl={mainContentEl}
      />
      {showHelmInstall && (
        <HelmInstallDialog
          namespace={firstNs}
          onClose={() => setShowHelmInstall(false)}
          onSuccess={() => setShowHelmInstall(false)}
        />
      )}
      {showHelmRepos && (
        <HelmRepositoriesDialog
          onClose={() => setShowHelmRepos(false)}
        />
      )}
      {swarmState.showWizard && (
        <SwarmConnectionWizard onClose={() => swarmState.actions.closeWizard()} />
      )}
    </>
  );
}

export default function AppContainer() {
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSection, setSelectedSection] = useState('pods');
  return (
    <ClusterStateProvider key={reloadKey}>
      <ResourceCountsProvider>
        <SwarmStateProvider>
          <SwarmResourceCountsProvider>
            <MainApp selectedSection={selectedSection} setSelectedSection={setSelectedSection} />
          </SwarmResourceCountsProvider>
        </SwarmStateProvider>
      </ResourceCountsProvider>
    </ClusterStateProvider>
  );
}
