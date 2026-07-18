import { useState } from 'react';
import type { docker } from '../../../../wailsjs/go/models';
import Button from '../../../components/ui/Button';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import { showError, showSuccess } from '../../../notification';
import { CloneSwarmConfig, ExportSwarmConfig, RemoveSwarmConfig } from '../../swarmApi';
import { showModalPrompt } from '../../../components/ModalProvider';
import SwarmResourceActions from '../SwarmResourceActions';
import ConfigCompareModal from './ConfigCompareModal';
import ConfigDataSection from './ConfigDataSection';
import ConfigEditModal from './ConfigEditModal';
import ConfigUsedBySection from './ConfigUsedBySection';

type ConfigSummaryPanelProps = {
	row: docker.SwarmConfigInfo;
	allConfigs?: docker.SwarmConfigInfo[];
	onRefresh?: () => void;
};

const quickInfoFields: QuickInfoField[] = [
	{ key: 'id', label: 'Config ID', type: 'break-word' },
	{ key: 'name', label: 'Name' },
	{
		key: 'dataSize',
		label: 'Data Size',
		getValue: (d: Record<string, unknown>) => {
			const size = d.dataSize as number | undefined;
			if (size === undefined || size === null) return '-';
			if (size < 1024) return `${size} bytes`;
			if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
			return `${(size / 1024 / 1024).toFixed(1)} MB`;
		},
	},
	{ key: 'createdAt', label: 'Created', type: 'date' },
	{ key: 'updatedAt', label: 'Updated', type: 'date' },
];

function ConfigSummaryPanel({ row, allConfigs = [], onRefresh }: ConfigSummaryPanelProps) {
	const [showCompare, setShowCompare] = useState(false);
	const [showEdit, setShowEdit] = useState(false);
	const [cloning, setCloning] = useState(false);
	const [downloading, setDownloading] = useState(false);

	const makeDefaultCloneName = () => {
		const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
		return `${row.name}@${iso}`;
	};

	const handleDelete = async () => {
		try {
			await RemoveSwarmConfig(row.id);
			showSuccess(`Config ${row.name} removed`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to remove config: ${err}`);
		}
	};

	const handleDownload = async () => {
		setDownloading(true);
		try {
			const savedPath = await ExportSwarmConfig(row.id, `${row.name}.txt`);
			if (!savedPath) return;
			showSuccess(`Saved config ${row.name}`);
		} catch (err) {
			showError(`Failed to download config: ${err}`);
		} finally {
			setDownloading(false);
		}
	};

	const handleClone = async () => {
    const newName = await showModalPrompt('New config name', makeDefaultCloneName());
    if (!newName) return;
		setCloning(true);
		try {
			await CloneSwarmConfig(row.id, newName);
			showSuccess(`Cloned config to ${newName}`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to clone config: ${err}`);
		} finally {
			setCloning(false);
		}
	};

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row.name}
				labels={row.labels}
				actions={(
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<Button size="sm" onClick={() => setShowEdit(true)}>Edit</Button>
						<Button id="swarm-config-compare-btn" size="sm" onClick={() => setShowCompare(true)}>Compare</Button>
						<Button id="swarm-config-download-btn" size="sm" onClick={handleDownload} disabled={downloading}>
							{downloading ? 'Downloading...' : 'Download'}
						</Button>
						<Button id="swarm-config-clone-btn" size="sm" onClick={handleClone} disabled={cloning}>
							{cloning ? 'Cloning...' : 'Clone'}
						</Button>
						<SwarmResourceActions resourceType="config" name={row.name} onDelete={handleDelete} />
					</div>
				)}
			/>

			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row.name}
					data={row}
					loading={false}
					error={null}
					fields={quickInfoFields}
				/>
				<div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
					<div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
						<ConfigDataSection configId={row.id} configName={row.name} />
					</div>
					<div style={{ width: 320, minWidth: 200, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)' }}>
						<ConfigUsedBySection configId={row.id} />
					</div>
				</div>
			</div>

			<ConfigCompareModal
				open={showCompare}
				baseConfigId={row.id}
				baseConfigName={row.name}
				configs={allConfigs}
				onClose={() => setShowCompare(false)}
			/>
			<ConfigEditModal
				open={showEdit}
				configId={row.id}
				configName={row.name}
				onClose={() => setShowEdit(false)}
				onSaved={() => onRefresh?.()}
			/>
		</div>
	);
}

export default ConfigSummaryPanel;
export { ConfigSummaryPanel };
