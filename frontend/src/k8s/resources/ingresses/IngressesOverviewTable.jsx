/**
 * IngressesOverviewTableGeneric
 * 
 * Migrated Ingresses table using GenericResourceTable component.
 * This replaces ~462 lines of IngressesOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { ingressConfig } from '../../../config/resourceConfigs';

export default function IngressesOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...ingressConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
