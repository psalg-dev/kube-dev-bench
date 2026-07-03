import { GenericResourceTable } from '../../../components/GenericResourceTable/index';
import { statefulsetConfig } from '../../../config/resourceConfigs';

type StatefulSetsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function StatefulSetsOverviewTable({ namespaces, namespace }: StatefulSetsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...statefulsetConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { StatefulSetsOverviewTable };
