import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { roleConfig } from '../../../config/resourceConfigs/roleConfig';

type RolesOverviewTableProps = { namespaces?: string[]; namespace?: string };

export default function RolesOverviewTable({ namespaces, namespace }: RolesOverviewTableProps) {
  return (
    <GenericResourceTable
      {...roleConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
