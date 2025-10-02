import './style.css';
import './app.css';

import {
  GetConfigMaps,
  GetCronJobs,
  GetCurrentConfig,
  GetDaemonSets,
  GetDeployments,
  GetIngresses,
  GetJobs,
  GetKubeContexts,
  GetNamespaces,
  GetOverview,
  GetPersistentVolumeClaims,
  GetPersistentVolumes,
  GetPodStatusCounts,
  GetReplicaSets,
  GetRunningPods,
  GetSecrets,
  GetStatefulSets,
  SetCurrentKubeContext,
  SetCurrentNamespace
} from '../wailsjs/go/main/App';
import ConnectionWizard from './ConnectionWizard.jsx';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {getSelectedSection, renderSidebarAndAttachHandlers, renderSidebarSections} from "./sidebar";
import {showError, showSuccess, showWarning} from './notification'
import {renderPodsMainContent, renderResourceMainContent} from "./main-content";
import { ContextSelect, NamespaceMultiSelect } from './Dropdowns.jsx';

// State
let selectedContext = '';
let selectedNamespace = '';
let selectedNamespaces = [];
let contextOptions = [];
let namespaceOptions = [];
let clusterConnected = false;
let isInitializing = false;
let showConnectionWizard = false;
let appRoot = null;
let contextSelectRoot = null;
let namespaceSelectRoot = null;
let isContextDisabled = true;
let isNamespaceDisabled = true;

// Section state
let selectedSection = 'pods';
let podCountUpdater = null;

// DOM element references (will be set when main app renders)
let selectElement, nsSelect, footerInfo, footerDot, mainPanels, sidebarSections;

// Check if we need to show the connection wizard
async function checkConnectionSetup() {
  try {
    // Always check if we can successfully connect with current config
    const config = await GetCurrentConfig();

    // Try to get contexts with current setup
    const contexts = await GetKubeContexts();

    // If no contexts available, definitely show wizard
    if (!contexts || contexts.length === 0) {
      showConnectionWizard = true;
      renderConnectionWizard();
      return;
    }

    // If we have contexts but no saved context, show wizard for selection
    if (!config.currentContext) {
      showConnectionWizard = true;
      renderConnectionWizard();
      return;
    }

    // Try to connect with saved context to verify it works
    try {
      await GetNamespaces();
      // Connection successful, proceed to main app
      showConnectionWizard = false;
      initializeMainApp();
    } catch (connectionErr) {
      // Connection failed with current setup, show wizard
      console.log('Connection failed with current setup:', connectionErr);
      showConnectionWizard = true;
      renderConnectionWizard();
    }

  } catch (err) {
    // If there's any error loading contexts, show the wizard
    console.log('Error in connection setup:', err);
    showConnectionWizard = true;
    renderConnectionWizard();
  }
}

function renderConnectionWizard() {
  const appElement = document.querySelector('#app');

  if (!appRoot) {
    appRoot = createRoot(appElement);
  }

  appRoot.render(
    React.createElement(ConnectionWizard, {
      onComplete: () => {
        showConnectionWizard = false;
        initializeMainApp();
      }
    })
  );
}

function initializeMainApp() {
  // Clear the React root and render the main app HTML
  if (appRoot) {
    appRoot.unmount();
    appRoot = null;
  }

  renderMainAppHTML();
  setupEventHandlers();
  mountSelects();
  initializeWithConfig();
}

function renderMainAppHTML() {
  document.querySelector('#app').innerHTML = `
    <div id="layout">
      <aside id="sidebar">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 14px; color: var(--gh-text-secondary, #ccc);">Connection</span>
          <button id="show-wizard-btn" style="background: transparent; border: 1px solid var(--gh-border, #444); color: var(--gh-text-secondary, #ccc); padding: 4px 8px; border-radius: 0; cursor: pointer; font-size: 12px;" title="Show Connection Wizard">⚙️</button>
        </div>
        <label for="kubecontext-root">Context:</label>
        <div class="input" id="kubecontext-root"></div>
        <label for="namespace-root">Namespace:</label>
        <div class="input" id="namespace-root"></div>
        <hr class="sidebar-separator" />
        <div id="sidebar-sections" style="flex: 1;">
          ${renderSidebarSections('pods')}
        </div>
        <button id="sidebar-toggle" title="Collapse Sidebar">
          <span>◀</span>
          <span>Hide Sidebar</span>
        </button>
      </aside>
      <main id="maincontent">
        <div id="error-container"></div>
        <div id="main-panels"></div>
      </main>
      <footer id="footer">
        <span id="footer-info"></span>
        <span id="footer-dot"></span>
      </footer>
    </div>
  `;

  // Re-initialize DOM element references
  selectElement = document.getElementById("kubecontext-root");
  nsSelect = document.getElementById("namespace-root");
  footerInfo = document.getElementById("footer-info");
  footerDot = document.getElementById("footer-dot");
  mainPanels = document.getElementById("main-panels");
  sidebarSections = document.getElementById("sidebar-sections");

  // Reset footer
  footerInfo.textContent = '';
  footerDot.style.background = '#ccc';
}

function mountSelects() {
  if (!contextSelectRoot && selectElement) {
    contextSelectRoot = createRoot(selectElement);
  }
  if (!namespaceSelectRoot && nsSelect) {
    namespaceSelectRoot = createRoot(nsSelect);
  }
  renderContextSelect();
  renderNamespaceSelect();
}

function renderContextSelect() {
  if (!contextSelectRoot) return;
  contextSelectRoot.render(
    React.createElement(ContextSelect, {
      value: selectedContext,
      options: contextOptions,
      disabled: isContextDisabled,
      onChange: onContextChange
    })
  );
}

function renderNamespaceSelect() {
  if (!namespaceSelectRoot) return;
  namespaceSelectRoot.render(
    React.createElement(NamespaceMultiSelect, {
      values: selectedNamespaces,
      options: namespaceOptions,
      disabled: isNamespaceDisabled,
      onChange: onNamespaceChange
    })
  );
}

function setupEventHandlers() {
  // Add wizard trigger button
  const wizardBtn = document.getElementById('show-wizard-btn');
  if (wizardBtn) {
    wizardBtn.onclick = () => {
      showConnectionWizard = true;
      renderConnectionWizard();
    };
  }

  // Add keyboard shortcut (Ctrl+K or Cmd+K)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      showConnectionWizard = true;
      renderConnectionWizard();
    }
  });

  // Sidebar toggle button
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.onclick = () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');

      // Update button content based on state with proper chevrons
      const isCollapsed = sidebar.classList.contains('collapsed');
      sidebarToggleBtn.innerHTML = isCollapsed
        ? '<span>▶</span><span>Show Sidebar</span>'
        : '<span>◀</span><span>Hide Sidebar</span>';
    };
  }
}

// Initialize with saved config and load data
async function initializeWithConfig() {
  isInitializing = true;
  try {
    const config = await GetCurrentConfig();
    selectedContext = config.currentContext;
    selectedNamespace = config.currentNamespace;
    selectedNamespaces = selectedNamespace ? [selectedNamespace] : [];

    // Enable context dropdown and load contexts
    isContextDisabled = false;
    contextOptions = await GetKubeContexts();
    if (!contextOptions || contextOptions.length === 0) {
      showWarning("No Kubernetes contexts found.");
      renderContextSelect();
      return;
    }

    renderContextSelect();

    // If we have a saved context, try to load its namespaces
    if (selectedContext) {
      try {
        const namespaces = await GetNamespaces();
        if (namespaces && namespaces.length > 0) {
          namespaceOptions = namespaces;
          isNamespaceDisabled = false;
          // Set to stored namespace if present, else first
          if (selectedNamespace && namespaces.includes(selectedNamespace)) {
            selectedNamespaces = [selectedNamespace];
          } else {
            selectedNamespaces = [namespaces[0]];
            selectedNamespace = namespaces[0];
          }
          // Only load overview if we have a valid namespace
          if (selectedNamespace) {
            clusterConnected = true;
            renderNamespaceSelect();
            renderSidebarAndAttachHandlers(renderMainContent, startPodCountUpdater);
            renderMainContent();
          }
        }
      } catch (err) {
        showError("Failed to connect with the saved cluster: " + err);
        isNamespaceDisabled = false;
        clusterConnected = false;
        renderNamespaceSelect();
      }
    }
    updateFooter();
  } catch (err) {
    showError("Error loading saved configuration: " + err);
    isContextDisabled = false;
    isNamespaceDisabled = false;
    renderContextSelect();
    renderNamespaceSelect();
  }
  isInitializing = false;
}

function updateFooter() {
  const nsText = selectedNamespaces && selectedNamespaces.length > 0 ? selectedNamespaces.join(', ') : '';
  footerInfo.textContent = selectedContext && nsText ? `${selectedContext} / ${nsText}` : '';
  if (clusterConnected) {
    footerDot.classList.add('connected');
  } else {
    footerDot.classList.remove('connected');
  }
}

function startPodCountUpdater() {
  stopPodCountUpdater();
  if (!selectedNamespace) return;
  const elId = 'sidebar-pod-counts';
  let lastSig = null;
  // track last counts to avoid DOM writes
  const lastCounts = {
    deployments: null,
    jobs: null,
    cronjobs: null,
    daemonsets: null,
    statefulsets: null,
    replicasets: null,
    configmaps: null,
    secrets: null,
    ingresses: null,
    persistentvolumeclaims: null,
    persistentvolumes: null,
  };
  const update = async () => {
    const el = document.getElementById(elId);
    if (!el) return;
    try {
      // Prefer precise status counts for color-coded display
      const counts = await GetPodStatusCounts(selectedNamespace);
      // Build a signature to avoid unnecessary DOM writes
      const sig = counts ? [counts.running, counts.pending, counts.failed, counts.succeeded, counts.unknown, counts.total].join('-') : 'x';
      if (sig !== lastSig) {
        lastSig = sig;
        const parts = [];
        const pushPart = (value, color, title) => {
          if (!value) return;
          parts.push(`<span title="${title}" style="color:${color}; font-weight: 700;">${value}</span>`);
        };
        // Colors aligned with table: green, yellow, red, grey
        pushPart(counts.running, '#2ea44f', 'Running');
        pushPart(counts.pending, '#e6b800', 'Pending/Creating');
        pushPart(counts.failed, '#d73a49', 'Failed');
        // Show succeeded & unknown in neutral grey if present
        pushPart(counts.succeeded, '#9aa0a6', 'Succeeded');
        pushPart(counts.unknown, '#9aa0a6', 'Unknown');

        // If there are no pods, show 0 in muted color
        if (counts.total === 0) {
          el.innerHTML = `<span style="color:#9aa0a6; font-weight:700;">0</span>`;
        } else if (parts.length > 0) {
          el.innerHTML = parts.join('<span style="color:#666;">/</span>');
        } else {
          // Fallback: show running as single number if others are zero
          el.innerHTML = `<span style="color:#2ea44f; font-weight:700;">${counts.running || 0}</span>`;
        }
      }
    } catch (err) {
      // Fallback to older API (running pods) for backward compatibility
      try {
        const pods = await GetRunningPods(selectedNamespace);
        const count = Array.isArray(pods) ? pods.length : 0;
        const fallbackSig = `r-${count}`;
        if (fallbackSig !== lastSig) {
          lastSig = fallbackSig;
          const el = document.getElementById(elId);
          if (el) el.innerHTML = `<span title="Running" style="color:#2ea44f; font-weight:700;">${count}</span>`;
        }
      } catch (_) {
        const el = document.getElementById(elId);
        if (el) el.innerHTML = `<span style="color:#9aa0a6; font-weight:700;">0</span>`;
      }
    }

    // Update other resource counts in parallel
    try {
      const [deployments, jobs, cronjobs, daemonsets, statefulsets, replicasets, configmaps, secrets, ingresses, persistentvolumeclaims, persistentvolumes] = await Promise.all([
        GetDeployments(selectedNamespace).catch(() => []),
        GetJobs(selectedNamespace).catch(() => []),
        GetCronJobs(selectedNamespace).catch(() => []),
        GetDaemonSets(selectedNamespace).catch(() => []),
        GetStatefulSets(selectedNamespace).catch(() => []),
        GetReplicaSets(selectedNamespace).catch(() => []),
        GetConfigMaps(selectedNamespace).catch(() => []),
        GetSecrets(selectedNamespace).catch(() => []),
        GetIngresses(selectedNamespace).catch(() => []),
        GetPersistentVolumeClaims(selectedNamespace).catch(() => []),
        GetPersistentVolumes().catch(() => []), // Note: cluster-wide, not namespace-specific
      ]);

      const setCount = (id, valueKey, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        const last = lastCounts[valueKey];
        const next = typeof value === 'number' ? value : (Array.isArray(value) ? value.length : 0);
        if (last !== next) {
          lastCounts[valueKey] = next;
          el.textContent = String(next);
          el.style.color = next > 0 ? '#8ecfff' : '#9aa0a6';
        }
      };

      setCount('sidebar-deployments-count', 'deployments', deployments);
      setCount('sidebar-jobs-count', 'jobs', jobs);
      setCount('sidebar-cronjobs-count', 'cronjobs', cronjobs);
      setCount('sidebar-daemonsets-count', 'daemonsets', daemonsets);
      setCount('sidebar-statefulsets-count', 'statefulsets', statefulsets);
      setCount('sidebar-replicasets-count', 'replicasets', replicasets);
      setCount('sidebar-configmaps-count', 'configmaps', configmaps);
      setCount('sidebar-secrets-count', 'secrets', secrets);
      setCount('sidebar-ingresses-count', 'ingresses', ingresses);
      setCount('sidebar-persistentvolumeclaims-count', 'persistentvolumeclaims', persistentvolumeclaims);
      setCount('sidebar-persistentvolumes-count', 'persistentvolumes', persistentvolumes);
    } catch (_) {
      // ignore; individual fetches already handled
    }
  };
  update();
  podCountUpdater = setInterval(update, 4000);
}

function stopPodCountUpdater() {
  if (podCountUpdater) {
    clearInterval(podCountUpdater);
    podCountUpdater = null;
  }
}


function renderMainContent() {
  switch (getSelectedSection()) {
    case 'pods':
      renderPodsMainContent(selectedNamespace);
      break;
    default:
      renderResourceMainContent(selectedNamespace);
      break;
  }
}

function onContextChange(value) {
  if (isInitializing) return;

  const previousContext = selectedContext;
  const previousNamespace = selectedNamespace;

  selectedContext = value || '';
  selectedNamespace = '';
  selectedNamespaces = [];
  updateFooter();

  isContextDisabled = false;
  renderContextSelect();

  GetNamespaces()
    .then((namespaces) => {
      if (!namespaces || namespaces.length === 0) {
        showWarning("No namespaces found.");
        if (previousContext) {
          selectedContext = previousContext;
          selectedNamespace = previousNamespace;
          selectedNamespaces = previousNamespace ? [previousNamespace] : [];
          renderContextSelect();
          renderNamespaceSelect();
          updateFooter();
        }
        return;
      }

      SetCurrentKubeContext(selectedContext);
      namespaceOptions = namespaces;
      isNamespaceDisabled = false;
      selectedNamespaces = [namespaces[0]];
      selectedNamespace = namespaces[0];
      clusterConnected = true;
      updateFooter();
      renderNamespaceSelect();

      SetCurrentNamespace(selectedNamespace)
        .then(() => {
          if (selectedNamespace) {
            renderSidebarAndAttachHandlers(renderMainContent, startPodCountUpdater);
            renderMainContent();
          }
        })
        .catch(() => {
          selectedNamespaces = previousNamespace ? [previousNamespace] : [];
          selectedNamespace = previousNamespace;
          updateFooter();
          renderNamespaceSelect();
        });
    })
    .catch((err) => {
      showError("Failed to connect to the cluster: " + err);
      if (previousContext) {
        selectedContext = previousContext;
        selectedNamespace = previousNamespace;
        selectedNamespaces = previousNamespace ? [previousNamespace] : [];
        renderContextSelect();
        renderNamespaceSelect();
        updateFooter();
      }
      isNamespaceDisabled = false;
      clusterConnected = false;
      updateFooter();
    });
}

function onNamespaceChange(values) {
  if (isInitializing) return;

  const previousNamespace = selectedNamespace;
  const newSelection = Array.isArray(values) ? values : [];
  selectedNamespaces = newSelection;
  selectedNamespace = newSelection[0] || '';

  // Immediately reflect the selection in the UI for controlled Select
  renderNamespaceSelect();
  updateFooter();

  if (!selectedNamespace) {
    // Nothing selected: keep footer updated, but don't call backend
    return;
  }

  GetOverview(selectedNamespace)
    .then(() => {
      SetCurrentNamespace(selectedNamespace)
        .then(() => {
          showSuccess(`Namespace "${selectedNamespace}" saved!`);
          updateFooter();
          startPodCountUpdater();
          // Re-render current section to apply new namespace
          renderMainContent();
        })
        .catch(() => {
          selectedNamespaces = previousNamespace ? [previousNamespace] : [];
          selectedNamespace = previousNamespace;
          updateFooter();
          renderNamespaceSelect();
        });
    })
    .catch((err) => {
      showError("Failed to switch namespace: " + err);
      selectedNamespaces = previousNamespace ? [previousNamespace] : [];
      selectedNamespace = previousNamespace;
      updateFooter();
      renderNamespaceSelect();
    });
}


// Start initialization by checking connection setup
checkConnectionSetup();
