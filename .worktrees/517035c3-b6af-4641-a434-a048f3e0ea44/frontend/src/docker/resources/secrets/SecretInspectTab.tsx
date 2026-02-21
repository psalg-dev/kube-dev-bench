import { GenericInspectTab } from '../../../components/GenericInspectTab';
import { GetSwarmSecretInspectJSON } from '../../swarmApi';

type SecretInspectTabProps = {
	secretId?: string;
};

function SecretInspectTab({ secretId }: SecretInspectTabProps) {
	const resolvedId = secretId ?? '';
	return (
		<GenericInspectTab
			id={resolvedId}
			fetchFn={GetSwarmSecretInspectJSON}
			loadingLabel="Loading secret inspect..."
			filename={`${resolvedId}.json`}
		/>
	);
}

export default SecretInspectTab;
export { SecretInspectTab };

