import { GenericResourceTable } from '../../../components/GenericResourceTable/index';
import { cronjobConfig } from '../../../config/resourceConfigs';

type CronJobsOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function CronJobsOverviewTable({ namespaces = [], namespace }: CronJobsOverviewTableProps) {
  return (
    <GenericResourceTable
      {...cronjobConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
