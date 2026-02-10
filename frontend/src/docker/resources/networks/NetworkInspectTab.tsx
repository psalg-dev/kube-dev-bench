import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmNetworkInspectJSON } from '../../swarmApi';

type NetworkInspectTabProps = {
	networkId?: string;
};

function NetworkInspectTab({ networkId }: NetworkInspectTabProps) {
	const resolvedId = networkId ?? '';
	return (
		<GenericInspectTab
			id={resolvedId}
			fetchFn={GetSwarmNetworkInspectJSON}
			loadingLabel="Loading network inspect..."
			filename={`${resolvedId}.json`}
		/>
	);
}

export default NetworkInspectTab;
export { NetworkInspectTab };

