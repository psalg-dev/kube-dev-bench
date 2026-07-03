import { serviceConfig } from '../../../config/resourceConfigs/serviceConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type ServicesOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function ServicesOverviewTable({ namespaces, namespace }: ServicesOverviewTableProps) {
  return (
    <GenericResourceTable
      {...serviceConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { ServicesOverviewTable };
