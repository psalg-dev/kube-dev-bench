import { helmReleasesConfig } from '../../../config/resourceConfigs/helmReleasesConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';

type HelmReleasesOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function HelmReleasesOverviewTable({ namespaces, namespace }: HelmReleasesOverviewTableProps) {
  return (
    <GenericResourceTable
      {...helmReleasesConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}

export { HelmReleasesOverviewTable };
