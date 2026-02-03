/**
 * DeploymentsOverviewTableGeneric
 * 
 * Refactored version of DeploymentsOverviewTable using GenericResourceTable.
 * This demonstrates the migration pattern from 462 lines to ~20 lines.
 * 
 * To complete migration:
 * 1. Rename this file to DeploymentsOverviewTable.jsx
 * 2. Delete the old DeploymentsOverviewTable.jsx
 * 3. Update any imports if needed
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { deploymentConfig } from '../../../config/resourceConfigs/deploymentConfig';

/**
 * Deployments Overview Table using GenericResourceTable
 * 
 * @param {Object} props - Component props
 * @param {Array<string>} props.namespaces - Selected namespaces
 * @param {string} props.namespace - Single namespace (fallback)
 */
export function DeploymentsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...deploymentConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export default DeploymentsOverviewTableGeneric;
