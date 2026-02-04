import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmConfigInspectJSON } from '../../swarmApi.js';

export default function ConfigInspectTab({ configId }) {
  return (
    <GenericInspectTab
      id={configId}
      fetchFn={GetSwarmConfigInspectJSON}
      loadingLabel="Loading config inspect..."
      filename={`${configId}.json`}
    />
  );
}
