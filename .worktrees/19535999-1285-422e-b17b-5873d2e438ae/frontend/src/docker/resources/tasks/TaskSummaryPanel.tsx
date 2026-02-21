import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';

interface TaskRow {
  id?: string;
  labels?: Record<string, string> | null;
  serviceName?: string;
  nodeName?: string;
  state?: string;
  desiredState?: string;
  error?: string;
  [key: string]: unknown;
}

interface TaskSummaryPanelProps {
  row?: TaskRow | null;
}

const quickInfoFields = [
  { key: 'id', label: 'Task ID', type: 'break-word' },
  { key: 'serviceName', label: 'Service', type: 'break-word' },
  { key: 'nodeName', label: 'Node', type: 'break-word' },
  { key: 'state', label: 'State' },
  { key: 'desiredState', label: 'Desired' },
  { key: 'error', label: 'Error', type: 'break-word' },
] satisfies QuickInfoField[];

export default function TaskSummaryPanel({ row }: TaskSummaryPanelProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader name={row?.id} labels={row?.labels} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row?.id}
          data={row ?? undefined}
          loading={false}
          error={null}
          fields={quickInfoFields}
        />
        <div style={{ flex: 1 }} />
      </div>
    </div>
  );
}
