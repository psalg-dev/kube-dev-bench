import { pvConfig } from '../../../config/resourceConfigs/pvConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type PersistentVolumesOverviewTableProps = {
  namespaces?: string[];
};

export default function PersistentVolumesOverviewTable({ namespaces }: PersistentVolumesOverviewTableProps) {
  return (
    <GenericResourceTable
      {...pvConfig}
      namespaces={namespaces}
      clusterScoped
    />
  );
}

export { PersistentVolumesOverviewTable };
