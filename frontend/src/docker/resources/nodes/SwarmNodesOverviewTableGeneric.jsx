import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmNodeConfig } from '../../../config/resourceConfigs/swarm';

/**
 * SwarmNodesOverviewTableGeneric - Nodes table using GenericResourceTable
 */
export default function SwarmNodesOverviewTable() {
  return <GenericResourceTable {...swarmNodeConfig} />;
}
