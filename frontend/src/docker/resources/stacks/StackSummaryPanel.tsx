import { useState, type CSSProperties } from 'react';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { showError, showSuccess } from '../../../notification';
import { CreateSwarmStack, GetSwarmStackComposeYAML, RollbackSwarmStack } from '../../swarmApi';
import { showModalConfirm } from '../../../components/ModalProvider';
import UpdateStackModal from './UpdateStackModal';
import type { docker } from '../../../../wailsjs/go/models';

const quickInfoFields = [
	{ key: 'name', label: 'Name', type: 'break-word' },
	{ key: 'services', label: 'Services' },
	{ key: 'networks', label: 'Networks' },
	{ key: 'volumes', label: 'Volumes' },
	{ key: 'configs', label: 'Configs' },
	{ key: 'secrets', label: 'Secrets' },
] satisfies QuickInfoField[];

const buttonStyle: CSSProperties = {
	padding: '6px 12px',
	borderRadius: 4,
	border: '1px solid var(--gh-border, #30363d)',
	backgroundColor: 'var(--gh-button-bg, #21262d)',
	color: 'var(--gh-text, #c9d1d9)',
	cursor: 'pointer',
	fontSize: 12,
	fontWeight: 500,
};

const downloadTextFile = (filename: string, content: string) => {
	const blob = new Blob([content ?? ''], { type: 'text/yaml;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

type StackSummaryPanelProps = {
	row: docker.SwarmStackInfo;
	onRefresh?: () => void;
};

export default function StackSummaryPanel({ row, onRefresh }: StackSummaryPanelProps) {
	const [showUpdate, setShowUpdate] = useState(false);
	const [compose, setCompose] = useState('');
	const [loadingCompose, setLoadingCompose] = useState(false);

	const loadCompose = async (): Promise<string> => {
		setLoadingCompose(true);
		try {
			const y = await GetSwarmStackComposeYAML(row.name);
			setCompose(y || '');
			return y || '';
		} finally {
			setLoadingCompose(false);
		}
	};

	const handleExport = async () => {
		try {
			const y = compose || (await loadCompose());
			downloadTextFile(`${row.name}.docker-compose.yml`, y || '');
			showSuccess(`Exported stack "${row.name}" compose`);
		} catch (err) {
			showError(`Failed to export compose: ${err}`);
		}
	};

	const handleOpenUpdate = async () => {
		try {
			const y = compose || (await loadCompose());
			setCompose(y || '');
			setShowUpdate(true);
		} catch (err) {
			showError(`Failed to load compose: ${err}`);
		}
	};

	const handleRedeploy = async (yaml: string) => {
		try {
			await CreateSwarmStack(row.name, yaml);
			showSuccess(`Updated stack "${row.name}"`);
			setShowUpdate(false);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to update stack: ${err}`);
		}
	};

	const handleRollback = async () => {
		const confirmed = await showModalConfirm(`Rollback stack "${row.name}"? This will attempt to rollback each service in the stack.`);
	if (!confirmed) return;
		try {
			await RollbackSwarmStack(row.name);
			showSuccess(`Rollback triggered for stack "${row.name}"`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to rollback stack: ${err}`);
		}
	};

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row?.name}
				actions={
					row?.name ? (
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<button id="swarm-stack-update-btn" style={buttonStyle} onClick={handleOpenUpdate} disabled={loadingCompose}>
								{loadingCompose ? 'Loading...' : 'Update'}
							</button>
							<button id="swarm-stack-export-btn" style={buttonStyle} onClick={handleExport} disabled={loadingCompose}>
								Export
							</button>
							<button id="swarm-stack-rollback-btn" style={buttonStyle} onClick={handleRollback}>
								Rollback
							</button>
						</div>
					) : null
				}
			/>
			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row?.name}
					data={row}
					loading={false}
					error={null}
					fields={quickInfoFields}
				/>
				<div style={{ flex: 1 }} />
			</div>
			<UpdateStackModal
				open={showUpdate}
				stackName={row?.name ?? ''}
				initialComposeYAML={compose}
				onClose={() => setShowUpdate(false)}
				onConfirm={handleRedeploy}
			/>
		</div>
	);
}

export { StackSummaryPanel };
