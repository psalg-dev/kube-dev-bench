import { useEffect, useState, useMemo, useCallback } from 'react';
import { ClusterStateProvider, useClusterState } from './state/ClusterStateContext';
import { AppLayout } from './layout/AppLayout';
import ConnectionWizard from './layout/connection/ConnectionWizard';
import { ContextSelect, NamespaceMultiSelect } from './Dropdowns';
import { ResourceCountsProvider } from './state/ResourceCountsContext';
// Docker Swarm providers
import { SwarmStateProvider, useSwarmState } from './docker/SwarmStateContext';
import { SwarmResourceCountsProvider } from './docker/SwarmResourceCountsContext';
import SwarmConnectionWizard from './docker/SwarmConnectionWizard';
// Holmes AI provider
import { HolmesProvider, useHolmes } from './holmes/HolmesContext';
import { HolmesPanel } from './holmes/HolmesPanel';
import { HolmesConfigModal } from './holmes/HolmesConfigModal';
// Resource overview tables
import PodOverviewTable from './k8s/resources/pods/PodOverviewTable';
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
import HelmInstallDialog from './k8s/resources/helmreleases/HelmInstallDialog';
import HelmRepositoriesDialog from './k8s/resources/helmreleases/HelmRepositoriesDialog';
// Docker Swarm resource views
import SwarmServicesOverviewTable from './docker/resources/services/SwarmServicesOverviewTable';
import SwarmTasksOverviewTable from './docker/resources/tasks/SwarmTasksOverviewTable';
import SwarmNodesOverviewTable from './docker/resources/nodes/SwarmNodesOverviewTable';
import SwarmNetworksOverviewTable from './docker/resources/networks/SwarmNetworksOverviewTable';
import SwarmConfigsOverviewTable from './docker/resources/configs/SwarmConfigsOverviewTable';
import SwarmSecretsOverviewTable from './docker/resources/secrets/SwarmSecretsOverviewTable';
import SwarmStacksOverviewTable from './docker/resources/stacks/SwarmStacksOverviewTable';
import SwarmVolumesOverviewTable from './docker/resources/volumes/SwarmVolumesOverviewTable';
import { showResourceOverlay } from './resource-overlay';

type MainAppProps = {
  selectedSection: string;
  setSelectedSection: (section: string) => void;
};

function MainApp({ selectedSection, setSelectedSection }: MainAppProps) {
  const {
    showWizard,
    actions,
    contexts,
    namespaces,
    selectedContext,
    selectedNamespaces,
    contextDisabled,
    namespaceDisabled,
    kubernetesAvailable,
  } = useClusterState() as any;
  const swarmState = useSwarmState() as any;
  const holmes = useHolmes() as any;
  const firstNs = useMemo(() => (Array.isArray(selectedNamespaces) && selectedNamespaces.length > 0 ? selectedNamespaces[0] : ''), [selectedNamespaces]);
  const [showHelmInstall, setShowHelmInstall] = useState(false);
  const [showHelmRepos, setShowHelmRepos] = useState(false);

  // Swarm-only mode: if Kubernetes isn't available (no kubeconfigs), force Swarm as the active view.
  useEffect(() => {
    if (kubernetesAvailable === false && !String(selectedSection).startsWith('swarm-')) {
      setSelectedSection('swarm-services');
    }
  }, [kubernetesAvailable, selectedSection, setSelectedSection]);

  // Global hotkey & sidebar toggle
  useEffect(() => {
    if (showWizard) return;
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); actions.openWizard(); }
      // Ctrl+Shift+H toggles Holmes panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') { e.preventDefault(); holmes.togglePanel(); }
    };
    document.addEventListener('keydown', keyHandler);
    const wizardBtn = document.getElementById('show-wizard-btn') as HTMLButtonElement | null;
    if (wizardBtn) wizardBtn.onclick = () => actions.openWizard();
    const toggleBtn = document.getElementById('sidebar-toggle') as HTMLButtonElement | null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWizard, actions]);

  // Map selectedSection -> component
  const mainContentEl = useMemo(() => {
    if (showWizard) return null;
    const commonNsProps = { namespaces: selectedNamespaces, namespace: firstNs };
    switch (selectedSection) {
      case 'pods':
        return <PodOverviewTable namespace={firstNs} namespaces={selectedNamespaces} onCreateResource={(type) => { if (type) showResourceOverlay(type); }} />;
      case 'deployments':
        return <DeploymentsOverviewTable {...commonNsProps} />;
      case 'services':
        return <ServicesOverviewTable {...commonNsProps} />;
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
        return <ConfigMapsOverviewTable {...commonNsProps} onConfigMapCreate={() => showResourceOverlay('configmap')} />;
      case 'secrets':
        return <SecretsOverviewTable {...commonNsProps} onSecretCreate={() => showResourceOverlay('secret')} />;
      case 'ingresses':
        return <IngressesOverviewTable {...commonNsProps} onIngressCreate={() => showResourceOverlay('ingress')} />;
      case 'persistentvolumeclaims':
        return <PersistentVolumeClaimsOverviewTable {...commonNsProps} onPVCCreate={() => showResourceOverlay('persistentvolumeclaim')} />;
      case 'persistentvolumes':
        return <PersistentVolumesOverviewTable namespaces={selectedNamespaces} />;
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

  const _renderPodsMainContent = useCallback(
    (selectedNamespacesArg: string[]) => {
      return <PodOverviewTable namespace={firstNs} namespaces={selectedNamespacesArg} onCreateResource={(type) => { if (type) showResourceOverlay(type); }} />;
    },
    [firstNs]
  );

  const _renderResourceMainContent = useCallback(
    (selectedNamespacesArg: string[], selectedSectionArg: string) => {
      const commonNsProps = { namespaces: selectedNamespacesArg, namespace: firstNs };
      switch (selectedSectionArg) {
        case 'deployments':
          return <DeploymentsOverviewTable {...commonNsProps} />;
        case 'services':
          return <ServicesOverviewTable {...commonNsProps} />;
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
          return <ConfigMapsOverviewTable {...commonNsProps} onConfigMapCreate={() => showResourceOverlay('configmap')} />;
        case 'secrets':
          return <SecretsOverviewTable {...commonNsProps} onSecretCreate={() => showResourceOverlay('secret')} />;
        case 'ingresses':
          return <IngressesOverviewTable {...commonNsProps} onIngressCreate={() => showResourceOverlay('ingress')} />;
        case 'persistentvolumeclaims':
          return <PersistentVolumeClaimsOverviewTable {...commonNsProps} onPVCCreate={() => showResourceOverlay('persistentvolumeclaim')} />;
        case 'persistentvolumes':
          return <PersistentVolumesOverviewTable namespaces={selectedNamespacesArg} />;
        case 'helmreleases':
          return <HelmReleasesOverviewTable {...commonNsProps} />;
        default:
          return null;
      }
    },
    [firstNs]
  );

  const handleSelectSection = (section: string) => {
    if (kubernetesAvailable === false && !String(section).startsWith('swarm-')) {
      return;
    }
    setSelectedSection(section);
  };

  if (showWizard) {
    return <ConnectionWizard onComplete={() => actions.closeWizard()} />;
  }

  return (
    <>
      <AppLayout
        kubernetesAvailable={kubernetesAvailable}
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
        onToggleHolmes={holmes.togglePanel}
        holmesPanelVisible={holmes.state.showPanel}
      />
      {/* Holmes AI Panel */}
      <HolmesPanel />
      <HolmesConfigModal />
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
        <SwarmConnectionWizard onComplete={() => swarmState.actions.closeWizard()} />
      )}
    </>
  );
}

export default function AppContainer() {
  const [reloadKey, _setReloadKey] = useState(0);
  const [selectedSection, setSelectedSection] = useState('pods');
  return (
    <ClusterStateProvider key={reloadKey}>
      <ResourceCountsProvider>
        <SwarmStateProvider>
          <SwarmResourceCountsProvider>
            <HolmesProvider>
              <MainApp selectedSection={selectedSection} setSelectedSection={setSelectedSection} />
            </HolmesProvider>
          </SwarmResourceCountsProvider>
        </SwarmStateProvider>
      </ResourceCountsProvider>
    </ClusterStateProvider>
  );
}
