import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../SwarmResourceActions';
import { ScaleSwarmService } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';
import type { docker } from '../../../../wailsjs/go/models';

type ServiceSummaryPanelProps = {
	row?: docker.SwarmServiceInfo | null;
};

const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date' }> = [
	{ key: 'name', label: 'Name', type: 'break-word' },
	{ key: 'id', label: 'Service ID', type: 'break-word' },
	{ key: 'mode', label: 'Mode' },
	{ key: 'replicas', label: 'Replicas' },
	{ key: 'runningTasks', label: 'Running Tasks' },
	{ key: 'image', label: 'Image', type: 'break-word' },
	{ key: 'createdAt', label: 'Created', type: 'date' },
];

export default function ServiceSummaryPanel({ row }: ServiceSummaryPanelProps) {
	const canScale = String(row?.mode ?? '').toLowerCase() === 'replicated';

	const handleScale = async (next: number) => {
		if (!row?.id) {
			showError('Missing service id');
			return;
		}
		try {
			await ScaleSwarmService(row.id, next);
			showSuccess(`Scaled service ${row.name} to ${next} replicas`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			showError(`Failed to scale service: ${message}`);
		}
	};

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row?.name}
				labels={row?.labels}
			/>
			{row?.name && (
				<div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gh-border, #30363d)' }}>
					<SwarmResourceActions
						resourceType="service"
						name={row.name}
						canScale={canScale}
						currentReplicas={row?.replicas ?? 0}
						onScale={handleScale}
					/>
				</div>
			)}
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
