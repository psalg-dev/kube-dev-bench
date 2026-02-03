import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmNetworkInspectJSON } from '../../swarmApi.js';

export default function NetworkInspectTab({ networkId }) {
  return (
    <GenericInspectTab
      id={networkId}
      fetchFn={GetSwarmNetworkInspectJSON}
      loadingLabel="Loading network inspect..."
      filename={`${networkId}.json`}
    />
  );
}
