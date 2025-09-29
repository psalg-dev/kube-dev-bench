import './style.css';
import './app.css';

import {GetKubeContexts, SetCurrentKubeContext, GetNamespaces, SetCurrentNamespace, GetCurrentConfig, GetRunningPods, CreateResource, GetOverview} from '../wailsjs/go/main/App';
import { renderPodOverviewTable } from './podOverviewReactEntry';

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

// Section state
let selectedSection = 'pods';
let podCountUpdater = null;
let lastPodCount = null;

document.querySelector('#app').innerHTML = `
  <div id="layout">
    <aside id="sidebar">
      <label for="kubecontext">Kontext:</label>
      <select class="input" id="kubecontext"></select>
      <label for="namespace">Namespace:</label>
      <select class="input" id="namespace"></select>
      <hr class="sidebar-separator" />
      <div id="sidebar-sections">
        ${renderSidebarSections()}
      </div>
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

let selectElement = document.getElementById("kubecontext");
let nsSelect = document.getElementById("namespace");
let footerInfo = document.getElementById("footer-info");
let footerDot = document.getElementById("footer-dot");
let mainPanels = document.getElementById("main-panels");
let sidebarSections = document.getElementById("sidebar-sections");

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
        // Do NOT call SetCurrentKubeContext here!
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
            // Do NOT call SetCurrentNamespace here!
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
        // Keep UI enabled even if connection failed
        nsSelect.disabled = false;
        clusterConnected = false;
      }
    }
    updateFooter();
  } catch (err) {
    showError("Fehler beim Laden der gespeicherten Konfiguration: " + err);
    // Ensure UI stays enabled
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
  // Only show Pods as a standalone entry in the sidebar
  return `
    <div class="sidebar-section${selectedSection === 'pods' ? ' selected' : ''}" id="section-pods" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 17px;">📦</span><span>Pods</span></span>
      <span class="sidebar-pod-count" id="sidebar-pod-count" style="min-width: 2em; text-align: right; font-weight: bold; color: #8ecfff;">-</span>
    </div>
  `;
}

function startPodCountUpdater() {
  stopPodCountUpdater();
  if (!selectedNamespace) return;
  const update = async () => {
    const el = document.getElementById('sidebar-pod-count');
    if (!el) return; // Only update if element exists
    try {
      const pods = await GetRunningPods(selectedNamespace);
      console.log('GetRunningPods:', pods, 'selectedNamespace:', selectedNamespace);
      const count = Array.isArray(pods) ? pods.length : 0;
      if (lastPodCount !== count) {
        lastPodCount = count;
        el.textContent = count;
      }
    } catch (err) {
      console.log('GetRunningPods error:', err, 'selectedNamespace:', selectedNamespace);
      el.textContent = '0';
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
  // Attach Pods entry click
  const podsEntry = document.getElementById('section-pods');
  if (podsEntry) podsEntry.onclick = (e) => { e.stopPropagation(); selectSection('pods'); };
  startPodCountUpdater();
}

function selectSection(section) {
  // Only update if section actually changes
  if (selectedSection === section) return;
  selectedSection = section;
  renderSidebarAndAttachHandlers();
  renderMainContent();
}

function renderMainContent() {
  // Always render pods as the main content
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

function renderMainPanels(overview, pods) {
  // Oberes Panel: Übersicht
  let upperPanel = `
    <div class="main-panel main-panel-overview">
      <div class="overview-card"><div>Pods</div><div class="overview-count">${overview ? overview.pods : '-'}</div></div>
      <div class="overview-card"><div>Deployments</div><div class="overview-count">${overview ? overview.deployments : '-'}</div></div>
      <div class="overview-card"><div>Jobs</div><div class="overview-count">${overview ? overview.jobs : '-'}</div></div>
    </div>
  `;

  // Mittleres Panel: Aktionen (REMOVE the create button from here)
  let middlePanel = '';

  // Unteres Panel: Pod-Liste (React placeholder)
  let lowerPanel = `
    <div class="main-panel main-panel-pods">
      <div id="pod-overview-react"></div>
    </div>
  `;

  return upperPanel + middlePanel + lowerPanel;
}

// Initial state
nsSelect.disabled = true;
selectElement.disabled = true;
footerInfo.textContent = '';
footerDot.style.background = '#ccc';

// Message handling functions
function showMessage(message, type = 'error') {
    const errorContainer = document.getElementById('error-container');
    const messageId = `message-${Date.now()}`;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    messageElement.id = messageId;
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-icon">${type === 'error' ? '⚠️' : '✓'}</span>
            <span class="message-preview">${message.split('\n')[0]}</span>
            <button class="message-expand">▼</button>
            <button class="message-close">×</button>
        </div>
        <div class="message-details">${message}</div>
    `;

    errorContainer.appendChild(messageElement);

    // Set up event listeners
    const closeBtn = messageElement.querySelector('.message-close');
    const expandBtn = messageElement.querySelector('.message-expand');
    const details = messageElement.querySelector('.message-details');

    closeBtn.onclick = () => {
        messageElement.remove();
    };

    expandBtn.onclick = () => {
        const isExpanded = details.style.display === 'block';
        details.style.display = isExpanded ? 'none' : 'block';
        expandBtn.textContent = isExpanded ? '▼' : '▲';
    };

    // Start progress bar animation 5 seconds before dismissal
    setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
            messageElement.classList.add('dismissing');
        }
    }, 5000);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
            messageElement.remove();
        }
    }, 10000);
}

// Error and success specific functions
function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

// Load contexts
GetKubeContexts()
  .then((contexts) => {
    if (!contexts || contexts.length === 0) {
      showError("Keine Kubernetes-Kontexte gefunden.");
      selectElement.disabled = true;
      nsSelect.disabled = true;
      return;
    }
    selectElement.innerHTML = contexts.map(ctx => `<option value="${ctx}">${ctx}</option>`).join("");
    selectElement.disabled = false;
    // Optionally: auto-select first context
    selectedContext = selectElement.value;
    updateFooter();
    // Trigger context change to load namespaces
    onContextChange();
  })
  .catch((err) => {
    showError("Fehler beim Laden der Kontexte: " + err);
    selectElement.disabled = true;
    nsSelect.disabled = true;
  });

function onContextChange() {
  if (isInitializing) return;

  const previousContext = selectedContext;
  const previousNamespace = selectedNamespace;

  selectedContext = selectElement.value;
  selectedNamespace = '';
  updateFooter();

  // Keep the select elements enabled during the process
  selectElement.disabled = false;

  // Try to fetch namespaces for the selected context first
  GetNamespaces()
    .then((namespaces) => {
      if (!namespaces || namespaces.length === 0) {
        showError("Keine Namespaces gefunden.");
        // Reset to previous context if available
        if (previousContext) {
          selectedContext = previousContext;
          selectedNamespace = previousNamespace;
          selectElement.value = previousContext;
          updateFooter();
        }
        return;
      }

      // Successfully loaded namespaces, now persist context
      SetCurrentKubeContext(selectedContext);
      nsSelect.innerHTML = namespaces.map(ns => `<option value="${ns}">${ns}</option>`).join("");
      nsSelect.disabled = false;
      selectedNamespace = nsSelect.value;
      clusterConnected = true;
      updateFooter();

      // Now try to set and persist the namespace
      SetCurrentNamespace(selectedNamespace)
        .then(() => {
          if (selectedNamespace) {
            renderSidebarAndAttachHandlers();
            renderMainContent();
          }
        })
        .catch(() => {
          // If setting namespace fails, do not persist, revert
          nsSelect.value = previousNamespace;
          selectedNamespace = previousNamespace;
          updateFooter();
        });
    })
    .catch((err) => {
      showError("Fehler beim Verbinden mit dem Cluster: " + err);
      // Reset to previous context if available
      if (previousContext) {
        selectedContext = previousContext;
        selectedNamespace = previousNamespace;
        selectElement.value = previousContext;
        updateFooter();
      }
      // Keep UI enabled
      nsSelect.disabled = false;
      clusterConnected = false;
      updateFooter();
    });
}

function onNamespaceChange() {
  if (isInitializing) return;

  const previousNamespace = selectedNamespace;
  selectedNamespace = nsSelect.value;
  // Try to fetch pods/overview for the selected namespace first
  GetOverview(selectedNamespace)
    .then(() => {
      // Only persist namespace if overview fetch is successful
      SetCurrentNamespace(selectedNamespace)
        .then(() => {
          showSuccess(`Namespace \"${selectedNamespace}\" gespeichert!`);
          updateFooter();
          selectSection('overview');
          startPodCountUpdater();
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

// Update loadOverviewAndPods to handle errors better
function loadOverviewAndPods() {
  if (!selectedNamespace) {
    mainPanels.innerHTML = '';
    return;
  }

  mainPanels.innerHTML = '<div class="main-panel-loading">Lade Übersicht ...</div>';

  Promise.all([
    GetOverview(selectedNamespace).catch(err => {
      showError("Fehler beim Laden der Übersicht: " + err);
      return null;
    }),
    GetRunningPods(selectedNamespace).catch(err => {
      showError("Fehler beim Laden der Pods: " + err);
      return [];
    })
  ]).then(([overview, pods]) => {
    // Always render panels, even with error state data
    mainPanels.innerHTML = renderMainPanels(overview, pods);
    // Mount React pod overview table
    const podOverviewContainer = document.getElementById('pod-overview-react');
    if (podOverviewContainer) {
      renderPodOverviewTable({ container: podOverviewContainer, namespace: selectedNamespace });
    }
  });
}

// Resource creation functionality
function setupResourceCreation() {
  const createBtn = document.getElementById('createResourceBtn');
  const resourceMenu = document.getElementById('resourceMenu');
  const menuItems = document.querySelectorAll('.resource-menu-item');

  // Toggle menu
  createBtn.onclick = (e) => {
    e.stopPropagation();
    resourceMenu.style.display = resourceMenu.style.display === 'none' ? 'block' : 'none';
  };

  // Close menu when clicking outside
  document.addEventListener('click', () => {
    resourceMenu.style.display = 'none';
  });

  // Handle resource selection
  menuItems.forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const resourceType = item.dataset.resource;
      showResourceOverlay(resourceType);
      resourceMenu.style.display = 'none';
    };
  });
}

// Resource template overlay
function showResourceOverlay(resourceType) {
  console.log('showResourceOverlay called with:', resourceType);

  const template = resourceTemplates[resourceType];
  if (!template) {
    console.error('No template found for resource type:', resourceType);
    return;
  }

  const title = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  console.log('Creating overlay for:', title);

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
  console.log('Overlay appended to body');

  // Initialize CodeMirror editor with all necessary extensions
  const customDarkTheme = EditorView.theme({
    "&": {
      color: "var(--gh-text)",
      backgroundColor: "var(--gh-input-bg)",
      height: "400px",
      fontSize: "14px"
    },
    ".cm-content": {
      fontFamily: "'Consolas', monospace",
      color: "var(--gh-text)",
      caretColor: "var(--gh-text)",
      padding: "10px",
      backgroundColor: "var(--gh-input-bg)"
    },
    "&.cm-editor": {
      backgroundColor: "var(--gh-input-bg)",
      height: "100%"
    },
    ".cm-gutters": {
      backgroundColor: "var(--gh-input-bg)",
      color: "var(--gh-text-muted)",
      border: "none",
      borderRight: "1px solid var(--gh-border)"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#23272e"
    },
    ".cm-line": {
      color: "var(--gh-text)",
      textAlign: "left"
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(56,139,253,0.08)"
    },
    "&.cm-focused": {
      outline: "none"
    },
    ".cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground": {
      background: "rgba(56,139,253,0.18) !important"
    },
    ".cm-cursor": {
      borderLeft: "2px solid var(--gh-accent)"
    },
    ".cm-property": {
      color: "#e0e0e0",
      fontWeight: "bold"
    },
    ".cm-string": {
      color: "#a3e635"
    },
    ".cm-number": {
      color: "#facc15"
    },
    ".cm-comment": {
      color: "#6b7280",
      fontStyle: "italic"
    },
    ".cm-keyword": {
      color: "#38bdf8"
    },
    ".cm-atom": {
      color: "#f472b6"
    },
    ".cm-def": {
      color: "#f472b6"
    }
  }, {dark: true});

  const state = EditorState.create({
    doc: template,
    extensions: [
      // A line number gutter
      lineNumbers(),
      // A gutter with code folding markers
      foldGutter(),
      // Replace non-printable characters with placeholders
      highlightSpecialChars(),
      // The undo history
      history(),
      // Replace native cursor/selection with our own
      drawSelection(),
      // Show a drop cursor when dragging over the editor
      dropCursor(),
      // Allow multiple cursors/selections
      EditorState.allowMultipleSelections.of(true),
      // Re-indent lines when typing specific input
      indentOnInput(),
      // Highlight syntax with a default style
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      // Highlight matching brackets near cursor
      bracketMatching(),
      // Allow alt-drag to select rectangular regions
      rectangularSelection(),
      // Change the cursor to a crosshair when holding alt
      crosshairCursor(),
      // Style the current line specially
      highlightActiveLine(),
      // Style the gutter for current line specially
      highlightActiveLineGutter(),
      // Highlight text that matches the selected text
      highlightSelectionMatches(),
      // YAML language support
      yaml(),
      // Add custom dark theme
      customDarkTheme,
      keymap.of([
        // Closed-brackets aware backspace
        ...closeBracketsKeymap,
        // A large set of basic bindings
        ...defaultKeymap,
        // Search-related keys
        ...searchKeymap,
        // Redo/undo keys
        ...historyKeymap,
        // Code folding bindings
        ...foldKeymap,
        // Autocompletion keys
        ...completionKeymap,
        // Keys related to the linter system
        ...lintKeymap
      ])
    ]
  });

  const editor = new EditorView({
    state,
    parent: document.querySelector("#resourceEditor")
  });

  console.log('CodeMirror editor created');

  // Close overlay
  const closeBtn = overlay.querySelector('.overlay-close');
  const cancelBtn = overlay.querySelector('.overlay-cancel-btn');
  closeBtn.onclick = cancelBtn.onclick = () => {
    console.log('Closing overlay');
    editor.destroy();
    overlay.remove();
  };

  // Create resource
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
      // Refresh only the relevant view
      if (selectedSection === 'pods') {
        // Re-render pods table only
        renderMainContent();
      } else {
        // Default: refresh overview
        loadOverviewAndPods();
      }
    } catch (err) {
      showError(`Fehler beim Erstellen: ${err}`);
      createBtn.disabled = false;
      createBtn.textContent = 'Erstellen';
    }
  };

  // Close on background click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      console.log('Closing overlay via background click');
      editor.destroy();
      overlay.remove();
    }
  };

  // Close on Escape key
  overlay.tabIndex = -1;
  overlay.focus();
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      console.log('Closing overlay via Escape key');
      editor.destroy();
      overlay.remove();
    }
  });

  console.log('Overlay setup complete');
}

// Initial Section-Handler setzen
renderSidebarAndAttachHandlers();
selectSection('pods');
startPodCountUpdater();

// Start initialization
initializeWithConfig();

selectElement.onchange = onContextChange;
nsSelect.onchange = onNamespaceChange;
