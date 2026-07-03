import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { roleBindingConfig } from '../../../config/resourceConfigs/roleBindingConfig';

type RoleBindingsOverviewTableProps = { namespaces?: string[]; namespace?: string };

export default function RoleBindingsOverviewTable({ namespaces, namespace }: RoleBindingsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...roleBindingConfig}
      namespaces={namespaces}
      namespace={namespace}
      createKind="rolebinding"
    />
  );
}
