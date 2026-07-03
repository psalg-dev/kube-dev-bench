import { GenericResourceTable } from '../../../components/GenericResourceTable/index';
import { deploymentConfig } from '../../../config/resourceConfigs';

type DeploymentsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function DeploymentsOverviewTable({ namespaces, namespace }: DeploymentsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...deploymentConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
