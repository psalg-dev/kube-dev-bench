/**
 * ReplicaSetsOverviewTableGeneric
 * 
 * Migrated ReplicaSets table using GenericResourceTable component.
 * This replaces the original ReplicaSetsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { replicasetConfig } from '../../../config/resourceConfigs';

export default function ReplicaSetsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...replicasetConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
