import { configmapConfig } from '../../../config/resourceConfigs/configmapConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type ConfigMapsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function ConfigMapsOverviewTable({ namespaces, namespace }: ConfigMapsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...configmapConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { ConfigMapsOverviewTable };
