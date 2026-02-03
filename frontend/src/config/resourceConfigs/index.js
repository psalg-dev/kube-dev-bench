/**
 * Resource Configurations Index
 * 
 * Barrel export for all resource configuration files.
 * These configs define columns, tabs, fetch functions, and panel content
 * for use with GenericResourceTable component.
 */

// Workload resources
export { deploymentConfig, deploymentColumns, deploymentTabs, normalizeDeployment, renderDeploymentPanelContent } from './deploymentConfig';
export { statefulsetConfig, statefulsetColumns, statefulsetTabs, normalizeStatefulSet, renderStatefulSetPanelContent } from './statefulsetConfig';
export { daemonsetConfig, daemonsetColumns, daemonsetTabs, normalizeDaemonSet, renderDaemonSetPanelContent } from './daemonsetConfig';
export { replicasetConfig, replicasetColumns, replicasetTabs, normalizeReplicaSet, renderReplicaSetPanelContent } from './replicasetConfig';
export { jobConfig, jobColumns, jobTabs, normalizeJob, renderJobPanelContent } from './jobConfig';
export { cronjobConfig, cronjobColumns, cronjobTabs, normalizeCronJob, renderCronJobPanelContent } from './cronjobConfig';
export { podConfig, podColumns, podTabs, normalizePod, renderPodPanelContent } from './podConfig';

// Configuration resources
export { configmapConfig, configmapColumns, configmapTabs, normalizeConfigMap, renderConfigMapPanelContent } from './configmapConfig';
export { secretConfig, secretColumns, secretTabs, normalizeSecret, renderSecretPanelContent } from './secretConfig';

// Network resources
export { serviceConfig, serviceColumns, serviceTabs, normalizeService, renderServicePanelContent } from './serviceConfig';
export { ingressConfig, ingressColumns, ingressTabs, normalizeIngress, renderIngressPanelContent } from './ingressConfig';

// Storage resources
export { pvConfig, pvColumns, pvTabs, normalizePV, renderPVPanelContent } from './pvConfig';
export { pvcConfig, pvcColumns, pvcTabs, normalizePVC, renderPVCPanelContent } from './pvcConfig';
