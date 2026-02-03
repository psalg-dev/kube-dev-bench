/**
 * StatefulSetsOverviewTableGeneric
 * 
 * Migrated StatefulSets table using GenericResourceTable component.
 * This replaces the original StatefulSetsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { statefulsetConfig } from '../../../config/resourceConfigs';

export default function StatefulSetsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...statefulsetConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
