import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';

interface NodeRow {
  hostname?: string;
  labels?: Record<string, string> | null;
  role?: string;
  availability?: string;
  state?: string;
  address?: string;
  engineVersion?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface NodeSummaryPanelProps {
  row?: NodeRow | null;
}

const quickInfoFields: QuickInfoField[] = [
  { key: 'hostname', label: 'Hostname', type: 'break-word' },
  { key: 'role', label: 'Role' },
  { key: 'availability', label: 'Availability' },
  { key: 'state', label: 'State' },
  { key: 'address', label: 'Address' },
  { key: 'engineVersion', label: 'Engine' },
  { key: 'createdAt', label: 'Created', type: 'date' },
];

export function NodeSummaryPanel({ row }: NodeSummaryPanelProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SummaryTabHeader name={row?.hostname} labels={row?.labels} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
        <QuickInfoSection
          resourceName={row?.hostname}
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

export default NodeSummaryPanel;
