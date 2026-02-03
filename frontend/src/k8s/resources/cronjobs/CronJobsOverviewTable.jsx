/**
 * CronJobsOverviewTableGeneric
 * 
 * Migrated CronJobs table using GenericResourceTable component.
 * This replaces ~455 lines of CronJobsOverviewTable.jsx with ~20 lines.
 */

import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { cronjobConfig } from '../../../config/resourceConfigs';

export default function CronJobsOverviewTableGeneric({ namespaces, namespace }) {
  return (
    <GenericResourceTable
      {...cronjobConfig}
      namespaces={namespaces}
      namespace={namespace}
    />
  );
}
