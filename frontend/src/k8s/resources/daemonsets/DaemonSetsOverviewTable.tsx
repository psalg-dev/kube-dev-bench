import { GenericResourceTable } from '../../../components/GenericResourceTable/index';
import { daemonsetConfig } from '../../../config/resourceConfigs';

type DaemonSetsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function DaemonSetsOverviewTable({ namespaces, namespace }: DaemonSetsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...daemonsetConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
