import { GenericResourceTable } from '../../../components/GenericResourceTable/index';
import { jobConfig } from '../../../config/resourceConfigs';

type JobsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function JobsOverviewTable({ namespaces, namespace }: JobsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...jobConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
