/**
 * JobsOverviewTableGeneric
 * 
 * Migrated Jobs table using GenericResourceTable component.
 * This replaces ~445 lines of JobsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { jobConfig } from '../../../config/resourceConfigs';

export default function JobsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...jobConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
