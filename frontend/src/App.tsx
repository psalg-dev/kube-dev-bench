import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ClusterStateProvider, useClusterState } from './state/ClusterStateContext';
import { AppLayout } from './layout/AppLayout';
import ConnectionWizard from './layout/connection/ConnectionWizard';
import { ContextSelect, NamespaceMultiSelect } from './Dropdowns';
import { renderPodsMainContent, renderResourceMainContent } from './main-content';
import { ResourceCountsProvider } from './state/ResourceCountsContext';
import { SwarmStateProvider, useSwarmState } from './docker/SwarmStateContext';
import { SwarmResourceCountsProvider } from './docker/SwarmResourceCountsContext';
import { useSwarmResourceCounts } from './docker/SwarmResourceCountsContext';
// Holmes AI provider and components
import { HolmesProvider, useHolmes } from './holmes/HolmesContext';
import { HolmesPanel } from './holmes/HolmesPanel';
import { HolmesConfigModal } from './holmes/HolmesConfigModal';
import { HolmesOnboardingWizard } from './holmes/HolmesOnboardingWizard';
// MCP server provider and components
import { MCPProvider, useMCP } from './mcp/MCPContext';
import { MCPConfigModal } from './mcp/MCPConfigModal';
import { sectionFromPath } from './router';
import type { SelectedSection } from './layout/connection/ConnectionsStateContext';

type MainContentBinderProps = {
  selectedSection: string;
  setConnectionWizardInitialSection?: (section: SelectedSection) => void;
};

function MainContentBinder({ selectedSection, setConnectionWizardInitialSection }: MainContentBinderProps) {
  const { selectedNamespaces, clusterConnected, actions, showWizard } = useClusterState() as any;
  const swarmState = useSwarmState() as any;
  const swarmCounts = useSwarmResourceCounts() as any;

  const isSwarmSection = selectedSection?.startsWith('swarm-');

  const renderMainContent = useCallback(() => {
    if (selectedSection === 'pods') {
      renderPodsMainContent(selectedNamespaces);
    } else {
      // BUGFIX: pass selectedSection so correct resource renders (was defaulting to deployments)
      renderResourceMainContent(selectedNamespaces, selectedSection, { swarmState, swarmCounts });
    }
  }, [selectedSection, selectedNamespaces, swarmState, swarmCounts]);

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
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('kubernetes');
        actions.openWizard();
      }
    };
    document.addEventListener('keydown', keyHandler);
    const sidebarToggleBtn = document.getElementById('sidebar-toggle') as HTMLButtonElement | null;
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
  onSelectSection: (section: string) => void;
  connectionWizardInitialSection: SelectedSection;
  setConnectionWizardInitialSection?: (section: SelectedSection) => void;
};

function LayoutOrWizard({ onWizardComplete, selectedSection, onSelectSection, connectionWizardInitialSection, setConnectionWizardInitialSection }: LayoutOrWizardProps) {
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
  const mcpCtx = useMCP();
  const navigate = useNavigate();

  // Swarm-only mode: if Kubernetes isn't available (no kubeconfigs detected),
  // ensure we land on a Swarm view so the main content isn't blank.
  useEffect(() => {
    if (kubernetesAvailable === false && !String(selectedSection).startsWith('swarm-')) {
      navigate('/swarm-services', { replace: true });
    }
  }, [kubernetesAvailable, selectedSection, navigate]);

  // Ctrl+Shift+H toggles Holmes panel
  useEffect(() => {
    if (showWizard) return;
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
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
          allowAddNamespace={!!selectedContext && !namespaceDisabled && Array.isArray(namespaces) && namespaces.length === 0}
          onAddNamespace={(name: string) => actions.createNamespace(name)}
        />}
        selectedSection={selectedSection}
        onSelectSection={(section) => {
          if (kubernetesAvailable === false && !String(section).startsWith('swarm-')) return;
          onSelectSection(section);
        }}
      />
      {/* Holmes AI Panel */}
      <HolmesPanel />
      <HolmesConfigModal />
      <HolmesOnboardingWizard />
      <MCPConfigModal />
      {/* Router outlet - not used for actual rendering, but needed for route matching */}
      <Outlet />
    </>
  );
}

export default function App() {
  const [reloadKey, setReloadKey] = useState(0);
  const [connectionWizardInitialSection, setConnectionWizardInitialSection] = useState<SelectedSection>('kubernetes');
  const handleWizardComplete = () => setReloadKey((k) => k + 1);

  const location = useLocation();
  const navigate = useNavigate();

  // Derive selectedSection from URL path
  const selectedSection = sectionFromPath(location.pathname);

  // Navigate to a section by changing the URL
  const setSelectedSection = useCallback((section: string) => {
    navigate(`/${section}`);
  }, [navigate]);

  // Handle navigation to resources from monitor modal
  useEffect(() => {
    const handleNavigateToResource = (event: Event) => {
      const detail = (event as CustomEvent).detail as { resource?: string; name?: string; namespace?: string };
      const { resource, name, namespace } = detail || {};

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

      // Navigate to the section using router
      navigate(`/${section}`);

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
        const rows = root.querySelectorAll('table.gh-table tbody tr');
        for (const row of rows) {
          const text = row.textContent || '';
          if (!text.includes(targetName)) continue;
          if (shouldMatchNamespace && !text.includes(targetNamespace)) continue;

          if (row instanceof HTMLElement) {
            row.click();
          }
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
  }, [navigate]);

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
                onSelectSection={setSelectedSection}
                connectionWizardInitialSection={connectionWizardInitialSection}
                setConnectionWizardInitialSection={setConnectionWizardInitialSection}
              />
              <MainContentBinder selectedSection={selectedSection} setConnectionWizardInitialSection={setConnectionWizardInitialSection} />
              </MCPProvider>
            </HolmesProvider>
          </SwarmResourceCountsProvider>
        </SwarmStateProvider>
      </ResourceCountsProvider>
    </ClusterStateProvider>
  );
}
