import { useState } from 'react';
import Button from '../../../components/ui/Button';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../../QuickInfoSection';
import { showError, showSuccess } from '../../../notification';
import { RemoveSwarmSecret } from '../../swarmApi';
import { showModalConfirm } from '../../../components/ModalProvider';
import SwarmResourceActions from '../SwarmResourceActions';
import SecretCloneModal from './SecretCloneModal';
import SecretDataSection from './SecretDataSection';
import SecretEditModal from './SecretEditModal';
import SecretUsedBySection from './SecretUsedBySection';

type SecretRow = {
	id: string;
	name: string;
	createdAt?: string;
	updatedAt?: string;
	labels?: Record<string, string>;
	driverName?: string;
};

type SecretSummaryPanelProps = {
	row: SecretRow;
	onRefresh?: () => void;
};

const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date'; getValue?: (_d: Record<string, unknown>) => unknown }> = [
	{ key: 'id', label: 'ID', type: 'break-word' },
	{ key: 'name', label: 'Name' },
	{ key: 'createdAt', label: 'Created', type: 'date' },
	{ key: 'updatedAt', label: 'Updated', type: 'date' },
	{ key: 'driverName', label: 'Driver', getValue: (d) => d?.driverName || '-' },
	{ key: 'external', label: 'External', getValue: (d) => (d?.driverName ? 'Yes' : 'No') },
];

function SecretSummaryPanel({ row, onRefresh }: SecretSummaryPanelProps) {
	const [showEdit, setShowEdit] = useState(false);
	const [showRotate, setShowRotate] = useState(false);
	const [showClone, setShowClone] = useState(false);

	const handleDelete = async () => {
		const confirmed = await showModalConfirm(`Delete secret "${row.name}"?`);
	if (!confirmed) return;
		try {
			await RemoveSwarmSecret(row.id);
			showSuccess(`Secret "${row.name}" deleted`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to delete secret: ${err}`);
		}
	};

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row.name}
				labels={row.labels}
				actions={(
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<Button id="swarm-secret-edit-btn" size="sm" onClick={() => setShowEdit(true)}>Edit</Button>
						<Button id="swarm-secret-rotate-btn" size="sm" onClick={() => setShowRotate(true)}>Rotate</Button>
						<Button id="swarm-secret-clone-btn" size="sm" onClick={() => setShowClone(true)}>Clone</Button>
						<SwarmResourceActions resourceType="secret" name={row.name} onDelete={handleDelete} />
					</div>
				)}
			/>

			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row.name}
					data={row ?? undefined}
					loading={false}
					error={null}
					fields={quickInfoFields}
				/>
				<div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
					<div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
						<SecretDataSection />
					</div>
					<div style={{ width: 320, minWidth: 200, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)' }}>
						<SecretUsedBySection secretId={row.id} />
					</div>
				</div>
			</div>

			<SecretEditModal
				open={showEdit}
				secretId={row.id}
				secretName={row.name}
				onClose={() => setShowEdit(false)}
				onSaved={() => onRefresh?.()}
			/>
			<SecretEditModal
				open={showRotate}
				secretId={row.id}
				secretName={row.name}
				titleVerb="Rotate"
				onClose={() => setShowRotate(false)}
				onSaved={() => onRefresh?.()}
			/>
			<SecretCloneModal
				open={showClone}
				sourceId={row.id}
				sourceName={row.name}
				onClose={() => setShowClone(false)}
				onCreated={() => onRefresh?.()}
			/>
		</div>
	);
}

export default SecretSummaryPanel;
export { SecretSummaryPanel };
