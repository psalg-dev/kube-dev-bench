import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { swarmStackConfig } from '../../../config/resourceConfigs/swarm';
import { useSwarmState } from '../../SwarmStateContext.jsx';

/**
 * SwarmStacksOverviewTableGeneric - Stacks table using GenericResourceTable
 */
export default function SwarmStacksOverviewTable() {
  const swarm = useSwarmState();
  const connected = swarm?.connected;

  if (!connected) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
        Not connected to Docker Swarm
      </div>
    );
  }

  return <GenericResourceTable {...swarmStackConfig} />;
}
