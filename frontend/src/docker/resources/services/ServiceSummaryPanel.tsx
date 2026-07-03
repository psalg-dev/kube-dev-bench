import { useState } from 'react';
import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../SwarmResourceActions';
import UpdateServiceImageModal from './UpdateServiceImageModal';
import Button from '../../../components/ui/Button';
import { ScaleSwarmService, UpdateSwarmServiceImage } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';
import type { docker } from '../../../../wailsjs/go/models';

type ServiceSummaryPanelProps = {
	row?: docker.SwarmServiceInfo | null;
	onRefresh?: () => void;
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

export default function ServiceSummaryPanel({ row, onRefresh }: ServiceSummaryPanelProps) {
	const [showUpdateImage, setShowUpdateImage] = useState(false);
	const canScale = String(row?.mode ?? '').toLowerCase() === 'replicated';

	const handleScale = async (next: number) => {
		if (!row?.id) {
			showError('Missing service id');
			return;
		}
		try {
			await ScaleSwarmService(row.id, next);
			showSuccess(`Scaled service ${row.name} to ${next} replicas`);
			onRefresh?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			showError(`Failed to scale service: ${message}`);
		}
	};

	const handleUpdateImage = async (newImage: string) => {
		if (!row?.id) {
			showError('Service ID is missing.');
			return;
		}
		try {
			await UpdateSwarmServiceImage(row.id, newImage);
			showSuccess(`Updated service ${row.name || row.id} image`);
			setShowUpdateImage(false);
			onRefresh?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			showError(`Failed to update service image: ${message}`);
		}
	};

	return (
		<>
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row?.name}
					labels={row?.labels}
					actions={
						row?.name ? (
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<Button id="swarm-service-update-image-btn" size="sm" onClick={() => setShowUpdateImage(true)}>
									Update Image
								</Button>
								<SwarmResourceActions
									resourceType="service"
									name={row.name}
									canScale={canScale}
									currentReplicas={row?.replicas ?? 0}
									onScale={handleScale}
								/>
							</div>
						) : null
					}
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
			<UpdateServiceImageModal
				open={showUpdateImage}
				currentImage={row?.image}
				serviceName={row?.name ?? ''}
				onClose={() => setShowUpdateImage(false)}
				onConfirm={handleUpdateImage}
			/>
		</>
	);
}
