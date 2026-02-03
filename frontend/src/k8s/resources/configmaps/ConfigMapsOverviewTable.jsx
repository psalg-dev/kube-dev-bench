/**
 * ConfigMapsOverviewTableGeneric
 * 
 * Migrated ConfigMaps table using GenericResourceTable component.
 * This replaces ~455 lines of ConfigMapsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { configmapConfig } from '../../../config/resourceConfigs';

export default function ConfigMapsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...configmapConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
