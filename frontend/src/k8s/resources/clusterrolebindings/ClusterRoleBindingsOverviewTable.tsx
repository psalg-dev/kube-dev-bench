import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { clusterRoleBindingConfig } from '../../../config/resourceConfigs/clusterRoleBindingConfig';

type ClusterRoleBindingsOverviewTableProps = { namespace?: string };

export default function ClusterRoleBindingsOverviewTable({ namespace }: ClusterRoleBindingsOverviewTableProps) {
  return <GenericResourceTable {...clusterRoleBindingConfig} namespace={namespace} />;
}
