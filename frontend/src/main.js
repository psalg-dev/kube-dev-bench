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
  SetCurrentNamespace,
  GetConnectionStatus,
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
let podCountUpdater = null;

// DOM element references (will be set when main app renders)
let selectElement, nsSelect, footerInfo, footerDot, mainPanels, sidebarSections;

// Check if we need to show the connection wizard
async function checkConnectionSetup() {
  try {
    const config = await GetCurrentConfig();
    const contexts = await GetKubeContexts();
    if (!contexts || contexts.length === 0) {
      showConnectionWizard = true;
      renderConnectionWizard();
      return;
    }
    // If there is no currentContext but contexts exist, proceed and we'll auto-select the first.
    // Only show wizard if we fail to fetch namespaces after auto-selection later.
    try {
      if (config.currentContext) {
        await GetNamespaces();
      }
      showConnectionWizard = false;
      initializeMainApp();
    } catch (connectionErr) {
      // We might not yet have a valid currentContext; still proceed – initializeMainApp will pick first context.
      showConnectionWizard = false;
      initializeMainApp();
    }
  } catch (err) {
    console.log('Error in connection setup:', err);
    showConnectionWizard = true;
    renderConnectionWizard();
  }
}

function renderConnectionWizard() {
  const appElement = document.querySelector('#app');
  // Ensure old dropdown roots are disposed so a future initializeMainApp() recreates them
  destroySelectRoots();
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
  // Stop any running counters before re-rendering layout
  stopPodCountUpdater();
  if (appRoot) {
    appRoot.unmount();
    appRoot = null;
  }
  // Always destroy select roots so they are recreated against the new DOM
  destroySelectRoots();
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
        <label for="namespace-root">Namespaces:</label>
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
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="footer-dot"></span>
          <span id="footer-warning" style="display: none; color: #d73a49; font-weight: bold; font-size: 16px;" title="Insecure connection: TLS certificate validation disabled">⚠️</span>
        </div>
      </footer>
    </div>
  `;

  selectElement = document.getElementById("kubecontext-root");
  nsSelect = document.getElementById("namespace-root");
  footerInfo = document.getElementById("footer-info");
  footerDot = document.getElementById("footer-dot");
  mainPanels = document.getElementById("main-panels");
  sidebarSections = document.getElementById("sidebar-sections");

  footerInfo.textContent = '';
  // Remove hard-coded inline background so CSS classes (.connected, .insecure) can control color
  footerDot.style.background = '';
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
  const wizardBtn = document.getElementById('show-wizard-btn');
  if (wizardBtn) {
    wizardBtn.onclick = () => {
      showConnectionWizard = true;
      renderConnectionWizard();
    };
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      showConnectionWizard = true;
      renderConnectionWizard();
    }
  });
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
}

// Helper: fetch namespaces for the currently selected context (assuming selectedContext set)
async function fetchAndSelectNamespaces(fallbackMessageShown = false) {
  try {
    const namespaces = await GetNamespaces();
    if (namespaces && namespaces.length > 0) {
      namespaceOptions = namespaces;
      isNamespaceDisabled = false;
      // Ensure selectedNamespaces intersects; otherwise choose first
      const valid = selectedNamespaces.filter(ns => namespaces.includes(ns));
      if (valid.length > 0) {
        selectedNamespaces = valid;
        selectedNamespace = valid[0];
      } else {
        selectedNamespaces = [namespaces[0]];
        selectedNamespace = namespaces[0];
        if (!fallbackMessageShown) {
          showSuccess(`Auto-selected namespace '${selectedNamespace}'.`);
        }
      }
      // Persist selection (best-effort)
      try {
        await Promise.all([
          (window?.go?.main?.App?.SetPreferredNamespaces ? window.go.main.App.SetPreferredNamespaces(selectedNamespaces) : Promise.resolve()),
          SetCurrentNamespace(selectedNamespace).catch(() => {}),
        ]);
      } catch (_) { /* ignore */ }
      clusterConnected = true;
      renderNamespaceSelect();
      renderSidebarAndAttachHandlers(renderMainContent, startPodCountUpdater);
      renderMainContent();
      // Update footer after successful connection to check security status
      await updateFooter();
    } else {
      showWarning('No namespaces found for the selected context.');
      namespaceOptions = [];
      selectedNamespaces = [];
      selectedNamespace = '';
      isNamespaceDisabled = false;
      renderNamespaceSelect();
    }
  } catch (err) {
    showError('Failed to fetch namespaces: ' + err);
    isNamespaceDisabled = false;
    renderNamespaceSelect();
  }
}

// Initialize with saved config and load data
async function initializeWithConfig() {
  isInitializing = true;
  try {
    const config = await GetCurrentConfig();
    selectedContext = config.currentContext;
    // prefer preferredNamespaces list; fallback to single currentNamespace
    const pref = config.preferredNamespaces || config.PreferredNamespaces || [];
    selectedNamespaces = Array.isArray(pref) ? pref.slice() : [];
    selectedNamespace = selectedNamespaces[0] || config.currentNamespace || '';

    isContextDisabled = false;
    contextOptions = await GetKubeContexts();
    if (!contextOptions || contextOptions.length === 0) {
      showWarning("No Kubernetes contexts found.");
      renderContextSelect();
      return;
    }

    // Auto-select first context if none stored
    if (!selectedContext) {
      selectedContext = contextOptions[0];
      try { await SetCurrentKubeContext(selectedContext); } catch (_) {}
      showSuccess(`Auto-selected context '${selectedContext}'.`);
    }

    renderContextSelect();

    if (selectedContext) {
      await fetchAndSelectNamespaces();
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

async function updateFooter() {
  const nsText = selectedNamespaces && selectedNamespaces.length > 0 ? selectedNamespaces.join(', ') : '';
  footerInfo.textContent = selectedContext && nsText ? `${selectedContext} / ${nsText}` : '';
  // Clear any inline background so class-based styling works
  footerDot.style.background = '';
  // Base state reset
  footerDot.classList.remove('insecure');
  if (clusterConnected) footerDot.classList.add('connected'); else footerDot.classList.remove('connected');

  // Check connection security status and show/hide warning indicator
  if (clusterConnected) {
    try {
      const connectionStatus = await GetConnectionStatus();
      const warningElement = document.getElementById('footer-warning');
      if (connectionStatus && connectionStatus.isInsecure) {
        // Show warning icon + make dot red
        footerDot.classList.remove('connected');
        footerDot.classList.add('insecure');
        footerDot.title = 'Insecure connection: TLS certificate validation disabled';
        if (warningElement) {
          warningElement.style.display = 'inline';
        }
        console.log('Showing insecure connection warning + red footer dot');
      } else {
        // Secure connection
        footerDot.classList.remove('insecure');
        if (clusterConnected) footerDot.classList.add('connected');
        footerDot.removeAttribute('title');
        if (warningElement) {
          warningElement.style.display = 'none';
        }
        console.log('Secure connection: green footer dot');
      }
    } catch (err) {
      console.error('Error checking connection status:', err);
      // On error, fall back to neutral dot and hide warning
      footerDot.classList.remove('insecure');
      if (clusterConnected) footerDot.classList.add('connected');
      const warningElement = document.getElementById('footer-warning');
      if (warningElement) warningElement.style.display = 'none';
    }
  } else {
    // Not connected, neutral dot
    footerDot.classList.remove('connected');
    footerDot.classList.remove('insecure');
    footerDot.removeAttribute('title');
    const warningElement = document.getElementById('footer-warning');
    if (warningElement) warningElement.style.display = 'none';
  }
}

function startPodCountUpdater() {
  stopPodCountUpdater();
  if (!selectedNamespaces || selectedNamespaces.length === 0) return;
  const elId = 'sidebar-pod-counts';
  let lastSig = null;
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
  const sumCounts = (a, b) => ({
    running: (a.running||0)+(b.running||0),
    pending: (a.pending||0)+(b.pending||0),
    failed: (a.failed||0)+(b.failed||0),
    succeeded: (a.succeeded||0)+(b.succeeded||0),
    unknown: (a.unknown||0)+(b.unknown||0),
    total: (a.total||0)+(b.total||0),
  });
  const update = async () => {
    const el = document.getElementById(elId);
    if (!el) return;
    try {
      // aggregate pod status across namespaces
      const countsList = await Promise.all((selectedNamespaces||[]).map(ns => GetPodStatusCounts(ns).catch(() => null)));
      const agg = countsList.filter(Boolean).reduce((acc, c) => sumCounts(acc, c), {running:0,pending:0,failed:0,succeeded:0,unknown:0,total:0});
      const sig = [agg.running, agg.pending, agg.failed, agg.succeeded, agg.unknown, agg.total].join('-');
      if (sig !== lastSig) {
        lastSig = sig;
        const parts = [];
        const pushPart = (value, color, title) => { if (!value) return; parts.push(`<span title="${title}" style="color:${color}; font-weight: 700;">${value}</span>`); };
        pushPart(agg.running, '#2ea44f', 'Running');
        pushPart(agg.pending, '#e6b800', 'Pending/Creating');
        pushPart(agg.failed, '#d73a49', 'Failed');
        pushPart(agg.succeeded, '#9aa0a6', 'Succeeded');
        pushPart(agg.unknown, '#9aa0a6', 'Unknown');
        if (agg.total === 0) {
          el.innerHTML = `<span style="color:#9aa0a6; font-weight:700;">0</span>`;
        } else if (parts.length > 0) {
          el.innerHTML = parts.join('<span style="color:#666;">/</span>');
        } else {
          el.innerHTML = `<span style="color:#2ea44f; font-weight:700;">${agg.running || 0}</span>`;
        }
      }
    } catch (err) {
      // Fallback: sum running pods across namespaces
      try {
        const lists = await Promise.all((selectedNamespaces||[]).map(ns => GetRunningPods(ns).catch(() => [])));
        const count = lists.reduce((n, arr) => n + (Array.isArray(arr)?arr.length:0), 0);
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

    // Update other resource counts in parallel (sum across namespaces)
    try {
      const nsArr = selectedNamespaces || [];
      const [depLists, jobLists, cjLists, dsLists, ssLists, rsLists, cmLists, secLists, ingLists, pvcLists, pvs] = await Promise.all([
        Promise.all(nsArr.map(ns => GetDeployments(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetJobs(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetCronJobs(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetDaemonSets(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetStatefulSets(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetReplicaSets(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetConfigMaps(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetSecrets(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetIngresses(ns).catch(() => []))),
        Promise.all(nsArr.map(ns => GetPersistentVolumeClaims(ns).catch(() => []))),
        GetPersistentVolumes().catch(() => []),
      ]);
      const flattenLen = (lists) => lists.reduce((n, arr) => n + (Array.isArray(arr)?arr.length:0), 0);
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
      setCount('sidebar-deployments-count', 'deployments', flattenLen(depLists));
      setCount('sidebar-jobs-count', 'jobs', flattenLen(jobLists));
      setCount('sidebar-cronjobs-count', 'cronjobs', flattenLen(cjLists));
      setCount('sidebar-daemonsets-count', 'daemonsets', flattenLen(dsLists));
      setCount('sidebar-statefulsets-count', 'statefulsets', flattenLen(ssLists));
      setCount('sidebar-replicasets-count', 'replicasets', flattenLen(rsLists));
      setCount('sidebar-configmaps-count', 'configmaps', flattenLen(cmLists));
      setCount('sidebar-secrets-count', 'secrets', flattenLen(secLists));
      setCount('sidebar-ingresses-count', 'ingresses', flattenLen(ingLists));
      setCount('sidebar-persistentvolumeclaims-count', 'persistentvolumeclaims', flattenLen(pvcLists));
      setCount('sidebar-persistentvolumes-count', 'persistentvolumes', pvs);
    } catch (_) {}
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
      renderPodsMainContent(selectedNamespaces);
      break;
    default:
      renderResourceMainContent(selectedNamespaces);
      break;
  }
}

function onContextChange(value) {
  if (isInitializing) return;
  const previousContext = selectedContext;
  const previousNamespace = selectedNamespace;
  const previousNamespaces = selectedNamespaces.slice();

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
          selectedNamespaces = previousNamespaces;
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

      Promise.all([
        (window?.go?.main?.App?.SetPreferredNamespaces ? window.go.main.App.SetPreferredNamespaces(selectedNamespaces) : Promise.resolve()),
        SetCurrentNamespace(selectedNamespace).catch(() => {}),
      ]).then(() => {
        if (selectedNamespaces.length > 0) {
          renderSidebarAndAttachHandlers(renderMainContent, startPodCountUpdater);
          renderMainContent();
        }
      }).catch(() => {
        selectedNamespaces = previousNamespaces;
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
        selectedNamespaces = previousNamespaces;
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
  const previous = selectedNamespaces.slice();
  const newSelection = Array.isArray(values) ? values : [];
  selectedNamespaces = newSelection;
  selectedNamespace = newSelection[0] || '';

  renderNamespaceSelect();
  updateFooter();

  if (!selectedNamespaces || selectedNamespaces.length === 0) {
    return;
  }

  // touch overview API for first namespace to verify connectivity
  GetOverview(selectedNamespaces[0])
    .then(() => {
      Promise.all([
        (window?.go?.main?.App?.SetPreferredNamespaces ? window.go.main.App.SetPreferredNamespaces(selectedNamespaces) : Promise.resolve()),
        SetCurrentNamespace(selectedNamespace).catch(() => {}),
      ]).then(() => {
        showSuccess(`Namespaces saved: ${selectedNamespaces.join(', ')}`);
        updateFooter();
        startPodCountUpdater();
        renderMainContent();
      }).catch(() => {
        selectedNamespaces = previous;
        selectedNamespace = previous[0] || '';
        updateFooter();
        renderNamespaceSelect();
      });
    })
    .catch((err) => {
      showError("Failed to switch namespaces: " + err);
      selectedNamespaces = previous;
      selectedNamespace = previous[0] || '';
      updateFooter();
      renderNamespaceSelect();
    });
}

// Helper to fully dispose the dropdown React roots so they can be cleanly recreated
function destroySelectRoots() {
  try { if (contextSelectRoot) { contextSelectRoot.unmount(); } } catch (_) {}
  try { if (namespaceSelectRoot) { namespaceSelectRoot.unmount(); } } catch (_) {}
  contextSelectRoot = null;
  namespaceSelectRoot = null;
}

// Start initialization by checking connection setup
checkConnectionSetup();
