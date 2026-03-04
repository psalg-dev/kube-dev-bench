import { useCallback, useEffect, useState } from 'react';
import { ContextSelect, NamespaceMultiSelect } from '../Dropdowns';
import { SwarmResourceCountsProvider, useSwarmResourceCounts } from '../docker/SwarmResourceCountsContext';
import { SwarmStateProvider, useSwarmState } from '../docker/SwarmStateContext';
import { renderPodsMainContent, renderResourceMainContent } from '../main-content';
import { ClusterStateProvider, useClusterState } from '../state/ClusterStateContext';
import { ResourceCountsProvider, useResourceCounts } from '../state/ResourceCountsContext';
import { AppLayout } from './AppLayout';
import ConnectionWizard from './connection/ConnectionWizard';
import type { SelectedSection } from './connection/ConnectionsStateContext';
// Holmes AI provider and components
import { HolmesConfigModal } from '../holmes/HolmesConfigModal';
import { HolmesProvider, useHolmes } from '../holmes/HolmesContext';
import { HolmesOnboardingWizard } from '../holmes/HolmesOnboardingWizard';
import { HolmesPanel } from '../holmes/HolmesPanel';
// MCP server provider and components
import { MCPConfigModal } from '../mcp/MCPConfigModal';
import { MCPProvider, useMCP } from '../mcp/MCPContext';
// Enterprise auth events
import { useEnterpriseAuthEvents } from '../hooks/useEnterpriseAuthEvents';
import { TLSCertErrorDialog } from './connection/TLSCertErrorDialog';
import { AuthExpiredBanner } from './connection/AuthExpiredBanner';
type MainContentBinderProps = {
  selectedSection: string;
  setConnectionWizardInitialSection?: (_section: SelectedSection) => void;
};
function MainContentBinder({ selectedSection, setConnectionWizardInitialSection }: MainContentBinderProps) {
  const clusterState = useClusterState();
  const { selectedNamespaces, clusterConnected, actions, showWizard } = clusterState;
  const swarmState = useSwarmState();
  const swarmCounts = useSwarmResourceCounts();
  const resourceCounts = useResourceCounts();

  const isSwarmSection = selectedSection?.startsWith('swarm-');

  const renderMainContent = useCallback(() => {
    if (selectedSection === 'pods') {
      renderPodsMainContent(selectedNamespaces);
    } else {
      // BUGFIX: pass selectedSection so correct resource renders (was defaulting to deployments)
      renderResourceMainContent(selectedNamespaces, selectedSection, { swarmState, swarmCounts, clusterState, resourceCounts });
    }
  }, [selectedSection, selectedNamespaces, swarmState, swarmCounts, clusterState, resourceCounts]);

  // Render main content whenever dependencies change
  useEffect(() => {
    if (showWizard) return;
    // For Swarm sections, render if swarm is connected
    // For K8s sections, render if cluster is connected
    if (isSwarmSection) {
      if (swarmState?.connected) {
        renderMainContent();
      }
    } else if (clusterConnected) {
      renderMainContent();
    }
  }, [clusterConnected, showWizard, renderMainContent, isSwarmSection, swarmState?.connected]);

  // Hotkey & button handlers (wizard & sidebar toggle)
  useEffect(() => {
    if (showWizard) return; // wizard has its own UI
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('kubernetes');
        actions.openWizard();
      }
    };
    document.addEventListener('keydown', keyHandler);
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.onclick = () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebarToggleBtn.innerHTML = isCollapsed
          ? '<span>▶</span><span>Show Sidebar</span>'
          : '<span>◀</span><span>Hide Sidebar</span>';
      };
    }
    return () => {
      document.removeEventListener('keydown', keyHandler);
      if (sidebarToggleBtn) sidebarToggleBtn.onclick = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWizard, actions]);

  return null; // side-effect only (no longer needed for counts)
}

type LayoutOrWizardProps = {
  onWizardComplete: () => void;
  selectedSection: string;
  setSelectedSection: (_section: string) => void;
  connectionWizardInitialSection: SelectedSection;
  setConnectionWizardInitialSection: (_section: SelectedSection) => void;
};

function LayoutOrWizard({
  onWizardComplete,
  selectedSection,
  setSelectedSection,
  connectionWizardInitialSection,
  setConnectionWizardInitialSection,
}: LayoutOrWizardProps) {
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
  } = useClusterState();
  const swarmState = useSwarmState();
  const holmes = useHolmes();
  const mcpCtx = useMCP();
  const enterpriseAuth = useEnterpriseAuthEvents();

  // Swarm-only mode: if Kubernetes isn't available (no kubeconfigs detected),
  // ensure we land on a Swarm view so the main content isn't blank.
  useEffect(() => {
    if (kubernetesAvailable === false && !String(selectedSection).startsWith('swarm-')) {
      setSelectedSection('swarm-services');
    }
  }, [kubernetesAvailable, selectedSection, setSelectedSection]);

  // Ctrl+Shift+H toggles Holmes panel
  useEffect(() => {
    if (showWizard) return;
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'H') {
        event.preventDefault();
        holmes.togglePanel();
      }
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [showWizard, holmes]);

  const handleWizardComplete = () => {
    actions.closeWizard();
    if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('kubernetes');
    // Refresh Docker Swarm connection status after wizard closes
    if (swarmState?.actions?.refreshConnectionStatus) {
      swarmState.actions.refreshConnectionStatus();
    }
    onWizardComplete();
  };

  if (showWizard) {
    return <ConnectionWizard onComplete={handleWizardComplete} initialSection={connectionWizardInitialSection} />;
  }
  return (
    <>
      <AppLayout
        kubernetesAvailable={kubernetesAvailable}
        onOpenConnectionsWizard={() => {
          if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('kubernetes');
          actions.openWizard();
        }}
        onOpenSwarmConnectionsWizard={() => {
          if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('docker-swarm');
          actions.openWizard();
        }}
        onToggleHolmes={holmes.togglePanel}
        holmesPanelVisible={holmes.state.showPanel}
        onToggleMCP={mcpCtx.showConfigModal}
        contextSelectEl={
          <ContextSelect
            value={selectedContext}
            options={contexts}
            disabled={contextDisabled}
            onChange={(v: string) => actions.selectContext(v)}
            onMenuOpen={() => actions.reloadContexts()}
          />
        }
        namespaceSelectEl={
          <NamespaceMultiSelect
            values={selectedNamespaces}
            options={namespaces}
            disabled={namespaceDisabled}
            onChange={(vals: string[]) => actions.selectNamespaces(vals)}
            onMenuOpen={() => actions.reloadNamespaces()}
            allowAddNamespace={!!selectedContext && !namespaceDisabled && Array.isArray(namespaces) && namespaces.length === 0}
            onAddNamespace={(name: string) => actions.createNamespace(name)}
          />
        }
        selectedSection={selectedSection}
        onSelectSection={(section) => {
          if (kubernetesAvailable === false && !String(section).startsWith('swarm-')) return;
          setSelectedSection(section);
        }}
      />
      {/* Holmes AI Panel */}
      <HolmesPanel />
      <HolmesConfigModal />
      <HolmesOnboardingWizard />
      <MCPConfigModal />
      {/* Enterprise Auth: TLS cert error dialog */}
      {enterpriseAuth.tlsCertError && (
        <TLSCertErrorDialog
          payload={enterpriseAuth.tlsCertError}
          onDismiss={enterpriseAuth.dismissTlsCertError}
          onInsecureConnected={() => actions.refreshConnectionStatus()}
          onAddCA={() => {
            if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('kubernetes');
            actions.openWizard();
          }}
        />
      )}
      {/* Enterprise Auth: auth expired banner */}
      {enterpriseAuth.authExpired && (
        <AuthExpiredBanner
          payload={enterpriseAuth.authExpired}
          onDismiss={enterpriseAuth.dismissAuthExpired}
          onReconnect={() => actions.refreshConnectionStatus()}
        />
      )}
    </>
  );
}

export default function AppContainer() {
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSection, setSelectedSection] = useState('pods');
  const [connectionWizardInitialSection, setConnectionWizardInitialSection] = useState<SelectedSection>('kubernetes');
  const handleWizardComplete = () => setReloadKey((k) => k + 1);

  // Handle navigation to resources from monitor modal
  useEffect(() => {
    const handleNavigateToResource = (event: Event) => {
      const customEvent = event as CustomEvent<{ resource?: string; name?: string; namespace?: string }>;
      const { resource, name, namespace } = customEvent.detail || {};

      // Map resource type to section name (Kubernetes and Swarm)
      const resourceToSection: Record<string, string> = {
        // Kubernetes resources
        Pod: 'pods',
        Deployment: 'deployments',
        StatefulSet: 'statefulsets',
        DaemonSet: 'daemonsets',
        ReplicaSet: 'replicasets',
        Job: 'jobs',
        CronJob: 'cronjobs',
        ConfigMap: 'configmaps',
        Secret: 'secrets',
        Ingress: 'ingresses',
        PersistentVolumeClaim: 'persistentvolumeclaims',
        PersistentVolume: 'persistentvolumes',
        // Swarm resources
        SwarmService: 'swarm-services',
        SwarmTask: 'swarm-tasks',
        SwarmNode: 'swarm-nodes',
        SwarmNetwork: 'swarm-networks',
        SwarmConfig: 'swarm-configs',
        SwarmSecret: 'swarm-secrets',
        SwarmStack: 'swarm-stacks',
        SwarmVolume: 'swarm-volumes',
      };

      const section = resource ? resourceToSection[resource] : undefined;
      if (!section) {
        console.warn(`Unknown resource type: ${resource}`);
        return;
      }

      // Navigate to the section
      setSelectedSection(section);

      // Wait for content to render, then find and click the row.
      // A single fixed timeout is flaky under load; poll briefly until the table is ready.
      const deadline = Date.now() + 8000;
      const targetName = String(name || '');
      const targetNamespace = String(namespace || '');
      const shouldMatchNamespace = targetNamespace.length > 0;

      const trySelectRow = () => {
        const panels = document.getElementById('main-panels');
        const candidates = panels ? Array.from(panels.children) : [];
        const visiblePanel = candidates.find((el) => {
          try {
            return window.getComputedStyle(el).display !== 'none';
          } catch {
            return false;
          }
        });

        const root = visiblePanel || document.getElementById('maincontent') || document;
        const rows = root.querySelectorAll<HTMLTableRowElement>('table.gh-table tbody tr');
        for (const row of rows) {
          const text = row.textContent || '';
          if (!text.includes(targetName)) continue;
          if (shouldMatchNamespace && !text.includes(targetNamespace)) continue;

          row.click();
          return true;
        }
        return false;
      };

      const poll = () => {
        if (trySelectRow()) return;
        if (Date.now() >= deadline) return;
        setTimeout(poll, 150);
      };

      poll();
    };

    window.addEventListener('navigate-to-resource', handleNavigateToResource);
    return () => {
      window.removeEventListener('navigate-to-resource', handleNavigateToResource);
    };
  }, []);

  return (
    <ClusterStateProvider key={reloadKey}>
      <ResourceCountsProvider>
        <SwarmStateProvider>
          <SwarmResourceCountsProvider>
            <HolmesProvider>
              <MCPProvider>
              <LayoutOrWizard
                onWizardComplete={handleWizardComplete}
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
                connectionWizardInitialSection={connectionWizardInitialSection}
                setConnectionWizardInitialSection={setConnectionWizardInitialSection}
              />
              <MainContentBinder
                selectedSection={selectedSection}
                setConnectionWizardInitialSection={setConnectionWizardInitialSection}
              />
              </MCPProvider>
            </HolmesProvider>
          </SwarmResourceCountsProvider>
        </SwarmStateProvider>
      </ResourceCountsProvider>
    </ClusterStateProvider>
  );
}
