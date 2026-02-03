/**
 * SwarmTasksOverviewTableGeneric.jsx
 * 
 * Swarm Tasks table using GenericResourceTable.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmTaskConfig } from '../../../config/resourceConfigs/swarm';

export default function SwarmTasksOverviewTable() {
  return <GenericResourceTable {...swarmTaskConfig} />;
}
