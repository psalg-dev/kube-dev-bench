import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmVolumeInspectJSON } from '../../swarmApi.js';

export default function VolumeInspectTab({ volumeName }) {
  return (
    <GenericInspectTab
      id={volumeName}
      fetchFn={GetSwarmVolumeInspectJSON}
      loadingLabel="Loading volume inspect..."
      filename={`${volumeName}.json`}
    />
  );
}
