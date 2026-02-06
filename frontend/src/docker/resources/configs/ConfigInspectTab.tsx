import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmConfigInspectJSON } from '../../swarmApi';

type ConfigInspectTabProps = {
	configId?: string;
};

function ConfigInspectTab({ configId }: ConfigInspectTabProps) {
	const resolvedId = configId ?? '';
	return (
		<GenericInspectTab
			id={resolvedId}
			fetchFn={GetSwarmConfigInspectJSON}
			loadingLabel="Loading config inspect..."
			filename={`${resolvedId}.json`}
		/>
	);
}

export default ConfigInspectTab;
export { ConfigInspectTab };

