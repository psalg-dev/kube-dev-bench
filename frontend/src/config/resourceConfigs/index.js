/**
 * Resource Configurations Index
 * 
 * Barrel export for all resource configuration files.
 * These configs define columns, tabs, fetch functions, and panel content
 * for use with GenericResourceTable component.
 */

export { deploymentConfig, deploymentColumns, deploymentTabs, normalizeDeployment, renderDeploymentPanelContent } from './deploymentConfig';
export { statefulsetConfig, statefulsetColumns, statefulsetTabs, normalizeStatefulSet, renderStatefulSetPanelContent } from './statefulsetConfig';

// Future resource configs will be exported here:
// export { daemonsetConfig } from './daemonsetConfig';
// export { podConfig } from './podConfig';
// etc.
