/**
 * ReplicaSetsOverviewTableGeneric
 *
 * Migrated ReplicaSets table using GenericResourceTable component.
 * This replaces the original ReplicaSetsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable/index';
import { replicasetConfig } from '../../../config/resourceConfigs';

type ReplicaSetsOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
};

export default function ReplicaSetsOverviewTableGeneric({ namespaces, namespace }: ReplicaSetsOverviewTableProps) {
	return (
		<GenericResourceTable
			{...replicasetConfig}
			namespaces={namespaces}
			namespace={namespace}
		/>
	);
}

export { ReplicaSetsOverviewTableGeneric };
