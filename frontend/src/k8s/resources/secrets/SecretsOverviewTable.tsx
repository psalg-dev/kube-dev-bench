import { secretConfig } from '../../../config/resourceConfigs/secretConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type SecretsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function SecretsOverviewTable({ namespaces, namespace }: SecretsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...secretConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { SecretsOverviewTable };
