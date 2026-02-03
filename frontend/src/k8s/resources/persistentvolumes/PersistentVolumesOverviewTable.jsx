/**
 * PersistentVolumesOverviewTableGeneric
 * 
 * Migrated PersistentVolumes table using GenericResourceTable component.
 * This replaces ~450 lines of PersistentVolumesOverviewTable.jsx with ~20 lines.
 * Note: PVs are cluster-scoped resources.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { pvConfig } from '../../../config/resourceConfigs';

export default function PersistentVolumesOverviewTableGeneric({ namespaces }) {
  return (
    <GenericResourceTable
      {...pvConfig}
      namespaces={namespaces}
    />
  );
}
