import { useEffect, useState, useCallback } from 'react';
import { ClusterStateProvider, useClusterState } from '../state/ClusterStateContext.jsx';
import { AppLayout } from './AppLayout.jsx';
import ConnectionWizard from './connection/ConnectionWizard.jsx';
import { ContextSelect, NamespaceMultiSelect } from '../Dropdowns.jsx';
import { renderPodsMainContent, renderResourceMainContent } from '../main-content';
import { ResourceCountsProvider } from '../state/ResourceCountsContext.jsx';
import { SwarmStateProvider, useSwarmState } from '../docker/SwarmStateContext.jsx';
import { SwarmResourceCountsProvider } from '../docker/SwarmResourceCountsContext.jsx';
import { useSwarmResourceCounts } from '../docker/SwarmResourceCountsContext.jsx';
// Holmes AI provider and components
import { HolmesProvider, useHolmes } from '../holmes/HolmesContext.jsx';
import { HolmesPanel } from '../holmes/HolmesPanel.jsx';
import { HolmesConfigModal } from '../holmes/HolmesConfigModal.jsx';
import { HolmesOnboardingWizard } from '../holmes/HolmesOnboardingWizard.jsx';
// MCP Server provider and components
import { MCPProvider, useMCP } from '../mcp/MCPContext.jsx';
import { MCPConfigModal } from '../mcp/MCPConfigModal.jsx';

function MainContentBinder({ selectedSection, setConnectionWizardInitialSection }) {
  const { selectedNamespaces, clusterConnected, actions, showWizard } = useClusterState();
  const swarmState = useSwarmState();
  const swarmCounts = useSwarmResourceCounts();

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
    const keyHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (setConnectionWizardInitialSection) setConnectionWizardInitialSection('kubernetes');
        actions.openWizard();
      }
    };
    document.addEventListener('keydown', keyHandler);
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.onclick = () => {
        const sidebar = document.getElementById('sidebar');
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

function LayoutOrWizard({ onWizardComplete, selectedSection, setSelectedSection, connectionWizardInitialSection, setConnectionWizardInitialSection }) {
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
  const mcpContext = useMCP();
  
  console.log('LayoutOrWizard mcpContext:', mcpContext);
  console.log('LayoutOrWizard mcpContext.showConfigModal:', mcpContext?.showConfigModal);

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
    const keyHandler = (e) => {
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
        onOpenMCPConfig={mcpContext.showConfigModal}
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
        onSelectSection={(section) => {
          if (kubernetesAvailable === false && !String(section).startsWith('swarm-')) return;
          setSelectedSection(section);
        }}
      />
      {/* Holmes AI Panel */}
      <HolmesPanel />
      <HolmesConfigModal />
      <HolmesOnboardingWizard />
      {/* MCP Server Config Modal */}
      <MCPConfigModal />
    </>
  );
}

export default function AppContainer() {
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSection, setSelectedSection] = useState('pods');
  const [connectionWizardInitialSection, setConnectionWizardInitialSection] = useState('kubernetes');
  const handleWizardComplete = () => setReloadKey(k => k + 1);

  // Handle navigation to resources from monitor modal
  useEffect(() => {
    const handleNavigateToResource = (event) => {
      const { resource, name, namespace } = event.detail;

      // Map resource type to section name (Kubernetes and Swarm)
      const resourceToSection = {
        // Kubernetes resources
        'Pod': 'pods',
        'Deployment': 'deployments',
        'StatefulSet': 'statefulsets',
        'DaemonSet': 'daemonsets',
        'ReplicaSet': 'replicasets',
        'Job': 'jobs',
        'CronJob': 'cronjobs',
        'ConfigMap': 'configmaps',
        'Secret': 'secrets',
        'Ingress': 'ingresses',
        'PersistentVolumeClaim': 'persistentvolumeclaims',
        'PersistentVolume': 'persistentvolumes',
        // Swarm resources
        'SwarmService': 'swarm-services',
        'SwarmTask': 'swarm-tasks',
        'SwarmNode': 'swarm-nodes',
        'SwarmNetwork': 'swarm-networks',
        'SwarmConfig': 'swarm-configs',
        'SwarmSecret': 'swarm-secrets',
        'SwarmStack': 'swarm-stacks',
        'SwarmVolume': 'swarm-volumes',
      };

      const section = resourceToSection[resource];
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
        const rows = root.querySelectorAll('table.gh-table tbody tr');
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
                <MainContentBinder selectedSection={selectedSection} setConnectionWizardInitialSection={setConnectionWizardInitialSection} />
              </MCPProvider>
            </HolmesProvider>
          </SwarmResourceCountsProvider>
        </SwarmStateProvider>
      </ResourceCountsProvider>
    </ClusterStateProvider>
  );
}
