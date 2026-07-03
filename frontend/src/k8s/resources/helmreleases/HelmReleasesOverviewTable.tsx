import { helmReleasesConfig } from '../../../config/resourceConfigs/helmReleasesConfig';
import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { showError, showSuccess } from '../../../notification';
import * as AppAPI from '../../../../wailsjs/go/main/App';

type HelmReleasesOverviewTableProps = {
  namespaces?: string[];
  namespace?: string;
};

export default function HelmReleasesOverviewTable({ namespaces, namespace }: HelmReleasesOverviewTableProps) {
  // ponytail: HPA/Helm row actions (rollback, uninstall) integrated via config + getRowActions override
  const getRowActions = (row: any) => [
    {
      label: 'Rollback',
      icon: '↩️',
      onClick: async () => {
        try {
          const history = await AppAPI.GetHelmReleaseHistory(row.namespace, row.name);
          const revisions = (history || []).map((h) => h.revision).filter((r) => Number.isInteger(r));
          if (revisions.length <= 1) {
            showError(`No previous revision available for '${row.name}'`);
            return;
          }
          const currentRevision = revisions[0];
          const candidates = revisions.filter((r) => r !== currentRevision);
          if (candidates.length === 0) {
            showError(`No previous revision available for '${row.name}'`);
            return;
          }
          const promptText = `Enter revision to rollback "${row.name}" (current: ${currentRevision}). Available: ${candidates.join(', ')}`;
          const input = window.prompt(promptText, String(candidates[0]));
          if (input === null || input === '') return;
          const targetRevision = Number(input);
          if (!Number.isInteger(targetRevision) || !candidates.includes(targetRevision)) {
            showError(`Invalid revision: ${input}`);
            return;
          }
          if (!window.confirm(`Rollback "${row.name}" to revision ${targetRevision}?`)) {
            return;
          }
          await AppAPI.RollbackHelmRelease(row.namespace, row.name, targetRevision);
          showSuccess(`Rolled back "${row.name}" to revision ${targetRevision}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Rollback failed: ${message}`);
        }
      },
    },
    {
      label: 'Uninstall',
      icon: '🗑️',
      danger: true,
      onClick: async () => {
        if (!window.confirm(`Are you sure you want to uninstall "${row.name}" from namespace "${row.namespace}"?`)) {
          return;
        }
        try {
          await AppAPI.UninstallHelmRelease(row.namespace, row.name);
          showSuccess(`Helm release '${row.name}' uninstalled`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showError(`Failed to uninstall Helm release '${row.name}': ${message}`);
        }
      },
    },
  ];

  return (
    <GenericResourceTable
      {...helmReleasesConfig}
      namespaces={namespaces}
      namespace={namespace}
      getRowActions={getRowActions}
    />
  );
}
