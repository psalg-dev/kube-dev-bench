import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { nodeConfig } from '../../../config/resourceConfigs/nodeConfig';

export default function NodesOverviewTable() {
  return (
    <GenericResourceTable
      {...nodeConfig}
      tableTestId="nodes-overview-table"
      createButtonTitle="Create Node"
      createNotice="Nodes are managed by your cluster infrastructure and are not created from this view."
    />
  );
}
