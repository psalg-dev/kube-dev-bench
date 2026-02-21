import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import type { docker } from '../../../../wailsjs/go/models';

type ServiceSummaryPanelProps = {
	row?: docker.SwarmServiceInfo | null;
};

const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date' }> = [
	{ key: 'name', label: 'Name', type: 'break-word' },
	{ key: 'mode', label: 'Mode' },
	{ key: 'replicas', label: 'Replicas' },
	{ key: 'runningTasks', label: 'Running Tasks' },
	{ key: 'image', label: 'Image', type: 'break-word' },
	{ key: 'createdAt', label: 'Created', type: 'date' },
];

export default function ServiceSummaryPanel({ row }: ServiceSummaryPanelProps) {
	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row?.name}
				labels={row?.labels}
			/>
			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row?.name}
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
