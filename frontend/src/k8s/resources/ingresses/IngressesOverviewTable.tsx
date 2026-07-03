import { ingressConfig } from '../../../config/resourceConfigs/ingressConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type IngressesOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function IngressesOverviewTable({ namespaces, namespace }: IngressesOverviewTableProps) {
  return (
    <GenericResourceTable
      {...ingressConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { IngressesOverviewTable };
