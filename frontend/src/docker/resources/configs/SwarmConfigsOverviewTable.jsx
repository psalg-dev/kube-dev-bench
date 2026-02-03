/**
 * SwarmConfigsOverviewTableGeneric
 * 
 * Migrated Swarm Configs table using GenericResourceTable component.
 * This replaces ~337 lines of SwarmConfigsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmConfigConfig } from '../../../config/resourceConfigs/swarm';

export default function SwarmConfigsOverviewTableGeneric() {
  return (
    <GenericResourceTable
      {...swarmConfigConfig}
    />
  );
}
