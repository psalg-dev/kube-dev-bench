import './style.css';
import './app.css';

import {GetKubeContexts, SetCurrentKubeContext, GetNamespaces, SetCurrentNamespace, GetCurrentConfig, GetRunningPods, CreateResource, GetOverview, GetKubeConfigs, SelectKubeConfigFile, SaveCustomKubeConfig, SetKubeConfigPath, GetKubeContextsFromFile, GetPodStatusCounts, GetDeployments, GetJobs, GetCronJobs, GetDaemonSets, GetStatefulSets, GetReplicaSets} from '../wailsjs/go/main/App';
import { renderPodOverviewTable } from './pods/PodOverviewEntry';
import ConnectionWizard from './ConnectionWizard.jsx';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DeploymentsOverviewTable from './deployments/DeploymentsOverviewTable';
import JobsOverviewTable from './jobs/JobsOverviewTable';
import CronJobsOverviewTable from './cronjobs/CronJobsOverviewTable';
import DaemonSetsOverviewTable from './daemonsets/DaemonSetsOverviewTable';
import StatefulSetsOverviewTable from './statefulsets/StatefulSetsOverviewTable';
import ReplicaSetsOverviewTable from './replicasets/ReplicaSetsOverviewTable';

import {EditorState} from "@codemirror/state"
import {
  EditorView, keymap, highlightSpecialChars, drawSelection,
  highlightActiveLine, dropCursor, rectangularSelection,
  crosshairCursor, lineNumbers, highlightActiveLineGutter
} from "@codemirror/view"
import {
  defaultHighlightStyle, syntaxHighlighting, indentOnInput,
  bracketMatching, foldGutter, foldKeymap
} from "@codemirror/language"
import {
  defaultKeymap, history, historyKeymap
} from "@codemirror/commands"
import {
  searchKeymap, highlightSelectionMatches
} from "@codemirror/search"
import {
  autocompletion, completionKeymap, closeBrackets,
  closeBracketsKeymap
} from "@codemirror/autocomplete"
import {lintKeymap} from "@codemirror/lint"
import {yaml} from "@codemirror/lang-yaml";

// State
let selectedContext = '';
let selectedNamespace = '';
let clusterConnected = false;
let errorTimeout = null;
let isInitializing = false;
let podFilter = '';
let showConnectionWizard = false;
let appRoot = null;

// Section state
let selectedSection = 'pods';
let podCountUpdater = null;
let lastPodCount = null;

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
        <label for="kubecontext">Kontext:</label>
        <select class="input" id="kubecontext"></select>
        <label for="namespace">Namespace:</label>
        <select class="input" id="namespace"></select>
        <hr class="sidebar-separator" />
        <div id="sidebar-sections" style="flex: 1;">
          ${renderSidebarSections()}
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
  selectElement = document.getElementById("kubecontext");
  nsSelect = document.getElementById("namespace");
  footerInfo = document.getElementById("footer-info");
  footerDot = document.getElementById("footer-dot");
  mainPanels = document.getElementById("main-panels");
  sidebarSections = document.getElementById("sidebar-sections");

  // Set initial disabled state
  nsSelect.disabled = true;
  selectElement.disabled = true;
  footerInfo.textContent = '';
  footerDot.style.background = '#ccc';
}

function setupEventHandlers() {
  selectElement.onchange = onContextChange;
  nsSelect.onchange = onNamespaceChange;

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

    // Always enable context dropdown
    selectElement.disabled = false;

    const contexts = await GetKubeContexts();
    if (!contexts || contexts.length === 0) {
      showError("Keine Kubernetes-Kontexte gefunden.");
      return;
    }

    // Fill contexts dropdown
    selectElement.innerHTML = contexts.map(ctx =>
      `<option value="${ctx}" ${ctx === selectedContext ? 'selected' : ''}>${ctx}</option>`
    ).join("");

    // If we have a saved context, try to load its namespaces
    if (selectedContext) {
      try {
        const namespaces = await GetNamespaces();
        if (namespaces && namespaces.length > 0) {
          nsSelect.innerHTML = namespaces.map(ns =>
            `<option value="${ns}">${ns}</option>`
          ).join("");
          nsSelect.disabled = false;
          clusterConnected = true;
          // Set dropdown to stored namespace if present, else first
          if (selectedNamespace && namespaces.includes(selectedNamespace)) {
            nsSelect.value = selectedNamespace;
          } else {
            nsSelect.value = namespaces[0];
            selectedNamespace = namespaces[0];
          }
          // Only load overview if we have a valid namespace
          if (nsSelect.value) {
            selectedNamespace = nsSelect.value;
            renderSidebarAndAttachHandlers();
            renderMainContent();
          }
        }
      } catch (err) {
        showError("Fehler beim Verbinden mit dem gespeicherten Cluster: " + err);
        nsSelect.disabled = false;
        clusterConnected = false;
      }
    }
    updateFooter();
  } catch (err) {
    showError("Fehler beim Laden der gespeicherten Konfiguration: " + err);
    selectElement.disabled = false;
    nsSelect.disabled = false;
  }
  isInitializing = false;
}

function updateFooter() {
  footerInfo.textContent = selectedContext && selectedNamespace ? `${selectedContext} / ${selectedNamespace}` : '';
  if (clusterConnected) {
    footerDot.classList.add('connected');
  } else {
    footerDot.classList.remove('connected');
  }
}

function renderSidebarSections() {
  return `
    <div class="sidebar-section${selectedSection === 'pods' ? ' selected' : ''}" id="section-pods" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Pods</span></span>
      <span class="sidebar-pod-counts" id="sidebar-pod-counts" style="display:flex; gap:8px; align-items:center; min-width: 2em; justify-content:flex-end;"><span style="color:#8ecfff; font-weight:bold;">-</span></span>
    </div>
    <div class="sidebar-section${selectedSection === 'deployments' ? ' selected' : ''}" id="section-deployments" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Deployments</span></span>
      <span id="sidebar-deployments-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'jobs' ? ' selected' : ''}" id="section-jobs" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Jobs</span></span>
      <span id="sidebar-jobs-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'cronjobs' ? ' selected' : ''}" id="section-cronjobs" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Cron Jobs</span></span>
      <span id="sidebar-cronjobs-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'daemonsets' ? ' selected' : ''}" id="section-daemonsets" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Daemon Sets</span></span>
      <span id="sidebar-daemonsets-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'statefulsets' ? ' selected' : ''}" id="section-statefulsets" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Stateful Sets</span></span>
      <span id="sidebar-statefulsets-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'replicasets' ? ' selected' : ''}" id="section-replicasets" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Replica Sets</span></span>
      <span id="sidebar-replicasets-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
  `;
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
      const [deployments, jobs, cronjobs, daemonsets, statefulsets, replicasets] = await Promise.all([
        GetDeployments(selectedNamespace).catch(() => []),
        GetJobs(selectedNamespace).catch(() => []),
        GetCronJobs(selectedNamespace).catch(() => []),
        GetDaemonSets(selectedNamespace).catch(() => []),
        GetStatefulSets(selectedNamespace).catch(() => []),
        GetReplicaSets(selectedNamespace).catch(() => []),
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

function renderSidebarAndAttachHandlers() {
  sidebarSections.innerHTML = renderSidebarSections();
  const podsEntry = document.getElementById('section-pods');
  if (podsEntry) podsEntry.onclick = (e) => { e.stopPropagation(); selectSection('pods'); };
  const deploymentsEntry = document.getElementById('section-deployments');
  if (deploymentsEntry) deploymentsEntry.onclick = (e) => { e.stopPropagation(); selectSection('deployments'); };
  const jobsEntry = document.getElementById('section-jobs');
  if (jobsEntry) jobsEntry.onclick = (e) => { e.stopPropagation(); selectSection('jobs'); };
  const cronJobsEntry = document.getElementById('section-cronjobs');
  if (cronJobsEntry) cronJobsEntry.onclick = (e) => { e.stopPropagation(); selectSection('cronjobs'); };
  const daemonSetsEntry = document.getElementById('section-daemonsets');
  if (daemonSetsEntry) daemonSetsEntry.onclick = (e) => { e.stopPropagation(); selectSection('daemonsets'); };
  const statefulSetsEntry = document.getElementById('section-statefulsets');
  if (statefulSetsEntry) statefulSetsEntry.onclick = (e) => { e.stopPropagation(); selectSection('statefulsets'); };
  const replicaSetsEntry = document.getElementById('section-replicasets');
  if (replicaSetsEntry) replicaSetsEntry.onclick = (e) => { e.stopPropagation(); selectSection('replicasets'); };
  startPodCountUpdater();
}

function selectSection(section) {
  if (selectedSection === section) return;
  selectedSection = section;
  renderSidebarAndAttachHandlers();
  renderMainContent();
}

function renderMainContent() {
  if (selectedSection === 'pods') {
    mainPanels.innerHTML = `
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
  } else if (selectedSection === 'deployments') {
    mainPanels.innerHTML = `<div class="main-panel" id="deployments-overview-react"></div>`;
    const deploymentsOverviewContainer = document.getElementById('deployments-overview-react');
    if (deploymentsOverviewContainer) {
      const root = createRoot(deploymentsOverviewContainer);
      root.render(React.createElement(DeploymentsOverviewTable, { namespace: selectedNamespace }));
    }
  } else if (selectedSection === 'jobs') {
    mainPanels.innerHTML = `<div class="main-panel" id="jobs-overview-react"></div>`;
    const jobsOverviewContainer = document.getElementById('jobs-overview-react');
    if (jobsOverviewContainer) {
      const root = createRoot(jobsOverviewContainer);
      root.render(React.createElement(JobsOverviewTable, { namespace: selectedNamespace }));
    }
  } else if (selectedSection === 'cronjobs') {
    mainPanels.innerHTML = `<div class="main-panel" id="cronjobs-overview-react"></div>`;
    const cronJobsOverviewContainer = document.getElementById('cronjobs-overview-react');
    if (cronJobsOverviewContainer) {
      const root = createRoot(cronJobsOverviewContainer);
      root.render(React.createElement(CronJobsOverviewTable, { namespace: selectedNamespace }));
    }
  } else if (selectedSection === 'daemonsets') {
    mainPanels.innerHTML = `<div class="main-panel" id="daemonsets-overview-react"></div>`;
    const daemonSetsOverviewContainer = document.getElementById('daemonsets-overview-react');
    if (daemonSetsOverviewContainer) {
      const root = createRoot(daemonSetsOverviewContainer);
      root.render(React.createElement(DaemonSetsOverviewTable, { namespace: selectedNamespace }));
    }
  } else if (selectedSection === 'statefulsets') {
    mainPanels.innerHTML = `<div class="main-panel" id="statefulsets-overview-react"></div>`;
    const statefulSetsOverviewContainer = document.getElementById('statefulsets-overview-react');
    if (statefulSetsOverviewContainer) {
      const root = createRoot(statefulSetsOverviewContainer);
      root.render(React.createElement(StatefulSetsOverviewTable, { namespace: selectedNamespace }));
    }
  } else if (selectedSection === 'replicasets') {
    mainPanels.innerHTML = `<div class="main-panel" id="replicasets-overview-react"></div>`;
    const replicaSetsOverviewContainer = document.getElementById('replicasets-overview-react');
    if (replicaSetsOverviewContainer) {
      const root = createRoot(replicaSetsOverviewContainer);
      root.render(React.createElement(ReplicaSetsOverviewTable, { namespace: selectedNamespace }));
    }
  }
}

// Resource templates
const resourceTemplates = {
  deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80`,

  job: `apiVersion: batch/v1
kind: Job
metadata:
  name: busybox-job
spec:
  template:
    spec:
      containers:
      - name: busybox
        image: busybox
        command: ["sh", "-c", "echo Hello Kubernetes! && sleep 30"]
      restartPolicy: Never
  backoffLimit: 4`
};

// Message handling functions
function showMessage(message, type = 'error') {
  const errorContainer = document.getElementById('error-container');
  if (!errorContainer) return;

  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}-message`;
  messageElement.innerHTML = `
    <div class="message-header">
      <span class="message-icon">${type === 'error' ? '⚠️' : '✓'}</span>
      <span class="message-preview">${message.split('\n')[0]}</span>
      <button class="message-close">×</button>
    </div>
  `;

  errorContainer.appendChild(messageElement);

  const closeBtn = messageElement.querySelector('.message-close');
  closeBtn.onclick = () => messageElement.remove();

  setTimeout(() => messageElement.remove(), 10000);
}

function showError(message) {
  showMessage(message, 'error');
}

function showSuccess(message) {
  showMessage(message, 'success');
}

function onContextChange() {
  if (isInitializing) return;

  const previousContext = selectedContext;
  const previousNamespace = selectedNamespace;

  selectedContext = selectElement.value;
  selectedNamespace = '';
  updateFooter();

  selectElement.disabled = false;

  GetNamespaces()
    .then((namespaces) => {
      if (!namespaces || namespaces.length === 0) {
        showError("Keine Namespaces gefunden.");
        if (previousContext) {
          selectedContext = previousContext;
          selectedNamespace = previousNamespace;
          selectElement.value = previousContext;
          updateFooter();
        }
        return;
      }

      SetCurrentKubeContext(selectedContext);
      nsSelect.innerHTML = namespaces.map(ns => `<option value="${ns}">${ns}</option>`).join("");
      nsSelect.disabled = false;
      selectedNamespace = nsSelect.value;
      clusterConnected = true;
      updateFooter();

      SetCurrentNamespace(selectedNamespace)
        .then(() => {
          if (selectedNamespace) {
            renderSidebarAndAttachHandlers();
            renderMainContent();
          }
        })
        .catch(() => {
          nsSelect.value = previousNamespace;
          selectedNamespace = previousNamespace;
          updateFooter();
        });
    })
    .catch((err) => {
      showError("Fehler beim Verbinden mit dem Cluster: " + err);
      if (previousContext) {
        selectedContext = previousContext;
        selectedNamespace = previousNamespace;
        selectElement.value = previousContext;
        updateFooter();
      }
      nsSelect.disabled = false;
      clusterConnected = false;
      updateFooter();
    });
}

function onNamespaceChange() {
  if (isInitializing) return;

  const previousNamespace = selectedNamespace;
  selectedNamespace = nsSelect.value;

  GetOverview(selectedNamespace)
    .then(() => {
      SetCurrentNamespace(selectedNamespace)
        .then(() => {
          showSuccess(`Namespace "${selectedNamespace}" gespeichert!`);
          updateFooter();
          startPodCountUpdater();
          // Re-render current section to apply new namespace
          renderMainContent();
        })
        .catch(() => {
          nsSelect.value = previousNamespace;
          selectedNamespace = previousNamespace;
          updateFooter();
        });
    })
    .catch((err) => {
      showError("Fehler beim Wechseln des Namespace: " + err);
      nsSelect.value = previousNamespace;
      selectedNamespace = previousNamespace;
      updateFooter();
    });
}

function showResourceOverlay(resourceType) {
  const template = resourceTemplates[resourceType];
  if (!template) return;

  const title = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="overlay-content">
      <div class="overlay-header">
        <div class="overlay-title">Neue ${title} Ressource</div>
        <button class="overlay-close">×</button>
      </div>
      <div id="resourceEditor" class="editor-wrapper"></div>
      <div style="display:flex;justify-content:flex-end;gap:1rem;margin-top:1.5rem;">
        <button class="overlay-cancel-btn">Abbrechen</button>
        <button class="overlay-create-btn" style="background:var(--gh-accent);color:#fff;border:none;padding:0.5em 1.5em;border-radius:6px;cursor:pointer;font-weight:600;">Erstellen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Initialize CodeMirror editor
  const customDarkTheme = EditorView.theme({
    "&": { color: "var(--gh-text)", backgroundColor: "var(--gh-input-bg)", height: "400px", fontSize: "14px" },
    ".cm-content": { fontFamily: "'Consolas', monospace", color: "var(--gh-text)", padding: "10px" },
    ".cm-gutters": { backgroundColor: "var(--gh-input-bg)", color: "var(--gh-text-muted)", border: "none" }
  }, {dark: true});

  const state = EditorState.create({
    doc: template,
    extensions: [
      lineNumbers(), foldGutter(), highlightSpecialChars(), history(), drawSelection(),
      dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }), bracketMatching(),
      rectangularSelection(), crosshairCursor(), highlightActiveLine(),
      highlightActiveLineGutter(), highlightSelectionMatches(), yaml(), customDarkTheme,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap])
    ]
  });

  const editor = new EditorView({
    state,
    parent: document.querySelector("#resourceEditor")
  });

  // Close overlay handlers
  const closeBtn = overlay.querySelector('.overlay-close');
  const cancelBtn = overlay.querySelector('.overlay-cancel-btn');
  closeBtn.onclick = cancelBtn.onclick = () => {
    editor.destroy();
    overlay.remove();
  };

  // Create resource handler
  const createBtn = overlay.querySelector('.overlay-create-btn');
  createBtn.onclick = async () => {
    const yaml = editor.state.doc.toString();
    createBtn.disabled = true;
    createBtn.textContent = 'Erstelle...';
    try {
      await CreateResource(selectedNamespace, yaml);
      showSuccess(`${title} wurde erfolgreich erstellt!`);
      editor.destroy();
      overlay.remove();
      renderMainContent();
    } catch (err) {
      showError(`Fehler beim Erstellen: ${err}`);
      createBtn.disabled = false;
      createBtn.textContent = 'Erstellen';
    }
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      editor.destroy();
      overlay.remove();
    }
  };
}

// Start initialization by checking connection setup
checkConnectionSetup();
