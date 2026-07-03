import { hpaConfig } from '../../../config/resourceConfigs/hpaConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type HPAOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function HPAOverviewTable({ namespaces, namespace }: HPAOverviewTableProps) {
  return (
    <GenericResourceTable
      {...hpaConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
