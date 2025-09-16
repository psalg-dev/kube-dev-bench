import './style.css';
import './app.css';

import {GetKubeContexts, SetCurrentKubeContext, GetNamespaces, SetCurrentNamespace} from '../wailsjs/go/main/App';

// State
let selectedContext = '';
let selectedNamespace = '';
let clusterConnected = false;

// Layout
// Remove splash logo, add sidebar and new footer
// Sidebar: 20% width, contains context and namespace dropdowns
// Main: 80% width, reserved for content/result
// Footer: max 25px, green dot if connected, context+namespace info

document.querySelector('#app').innerHTML = `
  <div id="layout">
    <aside id="sidebar">
      <label for="kubecontext">Kontext:</label>
      <select class="input" id="kubecontext"></select>
      <label for="namespace">Namespace:</label>
      <select class="input" id="namespace"></select>
      <hr class="sidebar-separator" />
    </aside>
    <main id="maincontent">
      <div class="result" id="result">Bitte wähle einen Kubernetes-Kontext und Namespace.</div>
    </main>
    <footer id="footer">
      <span id="footer-info"></span>
      <span id="footer-dot"></span>
    </footer>
  </div>
`;

let resultElement = document.getElementById("result");
let selectElement = document.getElementById("kubecontext");
let nsSelect = document.getElementById("namespace");
let footerInfo = document.getElementById("footer-info");
let footerDot = document.getElementById("footer-dot");

function updateFooter() {
  footerInfo.textContent = selectedContext && selectedNamespace ? `${selectedContext} / ${selectedNamespace}` : '';
  if (clusterConnected) {
    footerDot.classList.add('connected');
  } else {
    footerDot.classList.remove('connected');
  }
}

// Initial state
nsSelect.disabled = true;
selectElement.disabled = true;
footerInfo.textContent = '';
footerDot.style.background = '#ccc';

// Load contexts
GetKubeContexts()
  .then((contexts) => {
    if (!contexts || contexts.length === 0) {
      resultElement.innerText = "Keine Kubernetes-Kontexte gefunden.";
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
    resultElement.innerText = "Fehler beim Laden der Kontexte: " + err;
    selectElement.disabled = true;
    nsSelect.disabled = true;
  });

function onContextChange() {
  selectedContext = selectElement.value;
  selectedNamespace = '';
  clusterConnected = false;
  updateFooter();
  nsSelect.innerHTML = '';
  nsSelect.disabled = true;
  resultElement.innerText = `Kontext \"${selectedContext}\" gewählt. Namespaces werden geladen ...`;
  SetCurrentKubeContext(selectedContext)
    .then(() => GetNamespaces())
    .then((namespaces) => {
      if (!namespaces || namespaces.length === 0) {
        resultElement.innerText = "Keine Namespaces gefunden.";
        nsSelect.disabled = true;
        clusterConnected = false;
        updateFooter();
        return;
      }
      nsSelect.innerHTML = namespaces.map(ns => `<option value="${ns}">${ns}</option>`).join("");
      nsSelect.disabled = false;
      // Auto-select first namespace
      selectedNamespace = nsSelect.value;
      clusterConnected = true;
      updateFooter();
      SetCurrentNamespace(selectedNamespace);
      resultElement.innerText = "Namespace auswählen:";
    })
    .catch((err) => {
      resultElement.innerText = "Fehler beim Verbinden oder Laden der Namespaces: " + err;
      nsSelect.disabled = true;
      clusterConnected = false;
      updateFooter();
    });
}

function onNamespaceChange() {
  selectedNamespace = nsSelect.value;
  SetCurrentNamespace(selectedNamespace)
    .then(() => {
      resultElement.innerText = `Namespace \"${selectedNamespace}\" gespeichert!`;
      updateFooter();
    })
    .catch((err) => {
      resultElement.innerText = "Fehler beim Speichern des Namespace: " + err;
    });
}

selectElement.onchange = onContextChange;
nsSelect.onchange = onNamespaceChange;
