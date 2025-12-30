import React, { useEffect, useState, useCallback } from 'react';
import { ClusterStateProvider, useClusterState } from '../state/ClusterStateContext.jsx';
import { AppLayout } from './AppLayout.jsx';
import ConnectionWizard from './connection/ConnectionWizard.jsx';
import { ContextSelect, NamespaceMultiSelect } from '../Dropdowns.jsx';
import { renderPodsMainContent, renderResourceMainContent } from '../main-content';
import { ResourceCountsProvider } from '../state/ResourceCountsContext.jsx';

function MainContentBinder({ selectedSection }) {
  const { selectedNamespaces, clusterConnected, actions, showWizard } = useClusterState();

  const renderMainContent = useCallback(() => {
    if (selectedSection === 'pods') {
      renderPodsMainContent(selectedNamespaces);
    } else {
      // BUGFIX: pass selectedSection so correct resource renders (was defaulting to deployments)
      renderResourceMainContent(selectedNamespaces, selectedSection);
    }
  }, [selectedSection, selectedNamespaces]);

  // Render main content whenever dependencies change
  useEffect(() => {
    if (!clusterConnected || showWizard) return;
    renderMainContent();
  }, [clusterConnected, showWizard, renderMainContent]);

  // Hotkey & button handlers (wizard & sidebar toggle)
  useEffect(() => {
    if (showWizard) return; // wizard has its own UI
    const keyHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        actions.openWizard();
      }
    };
    document.addEventListener('keydown', keyHandler);
    const wizardBtn = document.getElementById('show-wizard-btn');
    if (wizardBtn) wizardBtn.onclick = () => actions.openWizard();
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
      if (wizardBtn) wizardBtn.onclick = null;
      if (sidebarToggleBtn) sidebarToggleBtn.onclick = null;
    };
  }, [showWizard, actions]);

  return null; // side-effect only (no longer needed for counts)
}

function LayoutOrWizard({ onWizardComplete, selectedSection, setSelectedSection }) {
  const { showWizard, actions, contexts, namespaces, selectedContext, selectedNamespaces, contextDisabled, namespaceDisabled } = useClusterState();

  if (showWizard) {
    return <ConnectionWizard onComplete={() => { actions.closeWizard(); onWizardComplete(); }} />;
  }
  return (
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
      onSelectSection={setSelectedSection}
    />
  );
}

export default function AppContainer() {
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSection, setSelectedSection] = useState('pods');
  const handleWizardComplete = () => setReloadKey(k => k + 1);

  // Handle navigation to resources from monitor modal
  useEffect(() => {
    const handleNavigateToResource = (event) => {
      const { resource, name, namespace } = event.detail;

      // Map resource type to section name
      const resourceToSection = {
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
      };

      const section = resourceToSection[resource];
      if (!section) {
        console.warn(`Unknown resource type: ${resource}`);
        return;
      }

      // Navigate to the section
      setSelectedSection(section);

      // Wait for content to render, then find and click the row
      setTimeout(() => {
        const rows = document.querySelectorAll('tbody tr');
        for (const row of rows) {
          if (row.textContent.includes(name) && row.textContent.includes(namespace)) {
            row.click();
            break;
          }
        }
      }, 500);
    };

    window.addEventListener('navigate-to-resource', handleNavigateToResource);
    return () => {
      window.removeEventListener('navigate-to-resource', handleNavigateToResource);
    };
  }, []);

  return (
    <ClusterStateProvider key={reloadKey}>
      <ResourceCountsProvider>
        <LayoutOrWizard onWizardComplete={handleWizardComplete} selectedSection={selectedSection} setSelectedSection={setSelectedSection} />
        <MainContentBinder selectedSection={selectedSection} />
      </ResourceCountsProvider>
    </ClusterStateProvider>
  );
}
