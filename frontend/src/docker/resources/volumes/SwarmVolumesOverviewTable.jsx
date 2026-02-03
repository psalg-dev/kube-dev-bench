/**
 * SwarmVolumesOverviewTableGeneric
 * 
 * Migrated Swarm Volumes table using GenericResourceTable component.
 * This replaces ~353 lines of SwarmVolumesOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmVolumeConfig } from '../../../config/resourceConfigs/swarm';

export default function SwarmVolumesOverviewTableGeneric() {
  return (
    <GenericResourceTable
      {...swarmVolumeConfig}
    />
  );
}
