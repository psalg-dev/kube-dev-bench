import {
    GetConfigMaps,
    GetCronJobs,
    GetDaemonSets,
    GetDeployments, GetIngresses,
    GetJobs,
    GetPersistentVolumeClaims,
    GetPersistentVolumes,
    GetPodStatusCounts, GetReplicaSets,
    GetRunningPods, GetSecrets, GetStatefulSets
} from "../wailsjs/go/main/App";
let selectedSection = 'pods';

export function renderSidebarAndAttachHandlers(renderMainContent, cb) {
    document.getElementById("sidebar-sections").innerHTML = renderSidebarSections('pods');
    const podsEntry = document.getElementById('section-pods');
    if (podsEntry) podsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('pods', renderMainContent);
    };
    const deploymentsEntry = document.getElementById('section-deployments');
    if (deploymentsEntry) deploymentsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('deployments', renderMainContent);
    };
    const jobsEntry = document.getElementById('section-jobs');
    if (jobsEntry) jobsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('jobs', renderMainContent);
    };
    const cronJobsEntry = document.getElementById('section-cronjobs');
    if (cronJobsEntry) cronJobsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('cronjobs', renderMainContent);
    };
    const daemonSetsEntry = document.getElementById('section-daemonsets');
    if (daemonSetsEntry) daemonSetsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('daemonsets', renderMainContent);
    };
    const statefulSetsEntry = document.getElementById('section-statefulsets');
    if (statefulSetsEntry) statefulSetsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('statefulsets', renderMainContent);
    };
    const replicaSetsEntry = document.getElementById('section-replicasets');
    if (replicaSetsEntry) replicaSetsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('replicasets', renderMainContent);
    };
    const configMapsEntry = document.getElementById('section-configmaps');
    if (configMapsEntry) configMapsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('configmaps', renderMainContent);
    };
    const secretsEntry = document.getElementById('section-secrets');
    if (secretsEntry) secretsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('secrets', renderMainContent);
    };
    const ingressesEntry = document.getElementById('section-ingresses');
    if (ingressesEntry) ingressesEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('ingresses', renderMainContent);
    };
    const persistentVolumeClaimsEntry = document.getElementById('section-persistentvolumeclaims');
    if (persistentVolumeClaimsEntry) persistentVolumeClaimsEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('persistentvolumeclaims', renderMainContent);
    };
    const persistentVolumesEntry = document.getElementById('section-persistentvolumes');
    if (persistentVolumesEntry) persistentVolumesEntry.onclick = (e) => {
        e.stopPropagation();
        selectSection('persistentvolumes', renderMainContent);
    };
    cb();
}

export function getSelectedSection () {
    return selectedSection;
}

export function selectSection(section, cb) {
    if (selectedSection === section) return;
    selectedSection = section;
    // Avoid re-rendering the entire sidebar to keep counters intact
    updateSidebarSelection();
    cb();
}

// NEW: Toggle selected class without re-rendering the sidebar to avoid flicker
export function updateSidebarSelection() {
    const sections = ['pods','deployments','jobs','cronjobs','daemonsets','statefulsets','replicasets','configmaps','secrets','ingresses','persistentvolumeclaims','persistentvolumes'];
    sections.forEach((sec) => {
        const el = document.getElementById(`section-${sec}`);
        if (!el) return;
        if (sec === selectedSection) el.classList.add('selected');
        else el.classList.remove('selected');
    });
}

export function renderSidebarSections(selectedSection) {
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
    <div class="sidebar-section${selectedSection === 'configmaps' ? ' selected' : ''}" id="section-configmaps" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Config Maps</span></span>
      <span id="sidebar-configmaps-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'secrets' ? ' selected' : ''}" id="section-secrets" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Secrets</span></span>
      <span id="sidebar-secrets-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'ingresses' ? ' selected' : ''}" id="section-ingresses" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Ingresses</span></span>
      <span id="sidebar-ingresses-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'persistentvolumeclaims' ? ' selected' : ''}" id="section-persistentvolumeclaims" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Persistent Volume Claims</span></span>
      <span id="sidebar-persistentvolumeclaims-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
    <div class="sidebar-section${selectedSection === 'persistentvolumes' ? ' selected' : ''}" id="section-persistentvolumes" style="padding: 8px 16px; cursor: pointer; color: var(--gh-table-header-text, #fff); font-size: 15px; margin: 0; border-radius: 4px; transition: background 0.15s; text-align: left; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
      <span style="display: flex; align-items: center; gap: 8px;"><span>Persistent Volumes</span></span>
      <span id="sidebar-persistentvolumes-count" style="min-width:2em; text-align:right; color:#9aa0a6; font-weight:700;">-</span>
    </div>
  `;
}
