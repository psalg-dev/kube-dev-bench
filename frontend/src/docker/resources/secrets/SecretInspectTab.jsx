import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmSecretInspectJSON } from '../../swarmApi.js';

export default function SecretInspectTab({ secretId }) {
  return (
    <GenericInspectTab
      id={secretId}
      fetchFn={GetSwarmSecretInspectJSON}
      loadingLabel="Loading secret inspect..."
      filename={`${secretId}.json`}
    />
  );
}
