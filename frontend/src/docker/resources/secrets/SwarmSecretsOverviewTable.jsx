/**
 * SwarmSecretsOverviewTableGeneric
 * 
 * Migrated Swarm Secrets table using GenericResourceTable component.
 * This replaces ~271 lines of SwarmSecretsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmSecretConfig } from '../../../config/resourceConfigs/swarm';

export default function SwarmSecretsOverviewTableGeneric() {
  return (
    <GenericResourceTable
      {...swarmSecretConfig}
    />
  );
}
