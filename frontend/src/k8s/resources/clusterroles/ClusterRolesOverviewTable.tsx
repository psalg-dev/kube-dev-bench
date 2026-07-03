import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { clusterRoleConfig } from '../../../config/resourceConfigs/clusterRoleConfig';

type ClusterRolesOverviewTableProps = { namespace?: string };

export default function ClusterRolesOverviewTable({ namespace }: ClusterRolesOverviewTableProps) {
  return <GenericResourceTable {...clusterRoleConfig} namespace={namespace} />;
}
