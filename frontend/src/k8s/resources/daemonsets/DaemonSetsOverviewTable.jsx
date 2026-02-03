/**
 * DaemonSetsOverviewTableGeneric
 * 
 * Migrated DaemonSets table using GenericResourceTable component.
 * This replaces ~455 lines of DaemonSetsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { daemonsetConfig } from '../../../config/resourceConfigs';

export default function DaemonSetsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...daemonsetConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
