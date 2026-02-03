/**
 * PersistentVolumeClaimsOverviewTableGeneric
 * 
 * Migrated PersistentVolumeClaims table using GenericResourceTable component.
 * This replaces ~482 lines of PersistentVolumeClaimsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { pvcConfig } from '../../../config/resourceConfigs';

export default function PersistentVolumeClaimsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...pvcConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
