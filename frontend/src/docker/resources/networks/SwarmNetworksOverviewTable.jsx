/**
 * SwarmNetworksOverviewTableGeneric
 * 
 * Migrated Swarm Networks table using GenericResourceTable component.
 * This replaces ~225 lines of SwarmNetworksOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmNetworkConfig } from '../../../config/resourceConfigs/swarm';

export default function SwarmNetworksOverviewTableGeneric() {
  return (
    <GenericResourceTable
      {...swarmNetworkConfig}
    />
  );
}
