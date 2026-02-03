/**
 * SecretsOverviewTableGeneric
 * 
 * Migrated Secrets table using GenericResourceTable component.
 * This replaces ~394 lines of SecretsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { secretConfig } from '../../../config/resourceConfigs';

export default function SecretsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...secretConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
