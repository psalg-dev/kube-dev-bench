/**
 * ServicesOverviewTableGeneric
 * 
 * Migrated Services table using GenericResourceTable component.
 * This replaces ~418 lines of ServicesOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { serviceConfig } from '../../../config/resourceConfigs';

export default function ServicesOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...serviceConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
