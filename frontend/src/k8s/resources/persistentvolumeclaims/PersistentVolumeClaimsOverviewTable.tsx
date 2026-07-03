import { pvcConfig } from '../../../config/resourceConfigs/pvcConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type PersistentVolumeClaimsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function PersistentVolumeClaimsOverviewTable({ namespaces, namespace }: PersistentVolumeClaimsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...pvcConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { PersistentVolumeClaimsOverviewTable };
