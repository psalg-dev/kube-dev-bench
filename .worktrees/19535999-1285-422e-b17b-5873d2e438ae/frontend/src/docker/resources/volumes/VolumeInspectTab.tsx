import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmVolumeInspectJSON } from '../../swarmApi';

type VolumeInspectTabProps = {
	volumeName: string;
};

export default function VolumeInspectTab({ volumeName }: VolumeInspectTabProps) {
	return (
		<GenericInspectTab
			id={volumeName}
			fetchFn={GetSwarmVolumeInspectJSON}
			loadingLabel="Loading volume inspect..."
			filename={`${volumeName}.json`}
		/>
	);
}

