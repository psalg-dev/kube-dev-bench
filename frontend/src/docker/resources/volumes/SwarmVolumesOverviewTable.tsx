import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../SwarmResourceActions';
import VolumeUsedBySection from './VolumeUsedBySection';
import VolumeFilesTab from './VolumeFilesTab';
import VolumeInspectTab from './VolumeInspectTab';
import { BackupSwarmVolume, CloneSwarmVolume, GetSwarmVolumes, GetSwarmVolumeUsage, RemoveSwarmVolume, RestoreSwarmVolume } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import type { docker } from '../../../../wailsjs/go/models';

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'driver', label: 'Driver' },
	{ key: 'scope', label: 'Scope' },
	{
		key: 'createdAt',
		label: 'Created',
		cell: ({ getValue }: { getValue: () => unknown }) => {
			const val = getValue();
			if (!val) return '-';
			return formatTimestampDMYHMS(String(val));
		},
	},
	{
		key: 'labels',
		label: 'Labels',
		cell: ({ getValue }: { getValue: () => unknown }) => {
			const labels = getValue() as Record<string, string> | null | undefined;
			if (!labels) return '-';
			const count = Object.keys(labels).length;
			return count > 0 ? `${count} label${count > 1 ? 's' : ''}` : '-';
		},
	},
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary' },
	{ key: 'files', label: 'Files' },
	{ key: 'inspect', label: 'JSON' },
];

type VolumeSummaryPanelProps = {
	row: docker.SwarmVolumeInfo;
	onRefresh?: () => void;
};

function VolumeSummaryPanel({ row, onRefresh }: VolumeSummaryPanelProps) {
	const [busy, setBusy] = useState({ backup: false, restore: false, clone: false });

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

	const handleDelete = async () => {
		try {
			const usage = await GetSwarmVolumeUsage(row.name);
			const services = Array.isArray(usage) ? (usage as docker.SwarmServiceRef[]) : [];
			if (services.length > 0) {
				const names = services
					.map((s) => s?.serviceName || s?.serviceId)
					.filter(Boolean)
					.slice(0, 10)
					.join(', ');
				const extra = services.length > 10 ? `, +${services.length - 10} more` : '';
				const msg = `Volume "${row.name}" is used by ${services.length} service${services.length === 1 ? '' : 's'} (${names}${extra}).\n\nDeleting it may break those services.\n\nDelete anyway?`;
				if (!window.confirm(msg)) return;
			} else {
				if (!window.confirm(`Delete volume "${row.name}"?`)) return;
			}
		} catch {
			// If usage lookup fails, fall back to standard confirm.
			if (!window.confirm(`Delete volume "${row.name}"?`)) return;
		}
		try {
			await RemoveSwarmVolume(row.name, false);
			showSuccess(`Volume "${row.name}" deleted`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to delete volume: ${err}`);
		}
	};

	const quickInfoFields = [
		{ key: 'name', label: 'Name' },
		{ key: 'driver', label: 'Driver' },
		{ key: 'scope', label: 'Scope' },
		{ key: 'mountpoint', label: 'Mountpoint', type: 'break-word' },
		{ key: 'createdAt', label: 'Created', type: 'date' },
	] satisfies QuickInfoField[];

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row.name}
				labels={row.labels}
				actions={(
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<button
							id="swarm-volume-backup-btn"
							style={buttonStyle}
							onClick={async () => {
								if (busy.backup) return;
								setBusy((s) => ({ ...s, backup: true }));
								try {
									const saved = await BackupSwarmVolume(row.name);
									if (!saved) return;
									showSuccess(`Backed up volume "${row.name}"`);
								} catch (err) {
									showError(`Failed to back up volume: ${err}`);
								} finally {
									setBusy((s) => ({ ...s, backup: false }));
								}
							}}
							disabled={busy.backup}
						>
							{busy.backup ? 'Backing up...' : 'Backup'}
						</button>

						<button
							id="swarm-volume-restore-btn"
							style={buttonStyle}
							onClick={async () => {
								if (busy.restore) return;
								if (!window.confirm(`Restore a backup into volume "${row.name}"? This may overwrite files.`)) return;
								setBusy((s) => ({ ...s, restore: true }));
								try {
									const selected = await RestoreSwarmVolume(row.name);
									if (!selected) return;
									showSuccess(`Restored backup into volume "${row.name}"`);
								} catch (err) {
									showError(`Failed to restore volume: ${err}`);
								} finally {
									setBusy((s) => ({ ...s, restore: false }));
								}
							}}
							disabled={busy.restore}
						>
							{busy.restore ? 'Restoring...' : 'Restore'}
						</button>

						<button
							id="swarm-volume-clone-btn"
							style={buttonStyle}
							onClick={async () => {
								if (busy.clone) return;
								const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
								const def = `${row.name}@${iso}`;
								const newName = window.prompt('New volume name', def);
								if (!newName) return;
								setBusy((s) => ({ ...s, clone: true }));
								try {
									await CloneSwarmVolume(row.name, newName);
									showSuccess(`Cloned volume to "${newName}"`);
									onRefresh?.();
								} catch (err) {
									showError(`Failed to clone volume: ${err}`);
								} finally {
									setBusy((s) => ({ ...s, clone: false }));
								}
							}}
							disabled={busy.clone}
						>
							{busy.clone ? 'Cloning...' : 'Clone'}
						</button>

						<SwarmResourceActions
							resourceType="volume"
							name={row.name}
							onDelete={handleDelete}
						/>
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
				<VolumeUsedBySection volumeName={row.name} />
			</div>
		</div>
	);
}

function renderPanelContent(row: docker.SwarmVolumeInfo, tab: string, onRefresh: (() => void) | undefined) {
	if (tab === 'files') {
		return <VolumeFilesTab volumeName={row.name} />;
	}

	if (tab === 'inspect') {
		return <VolumeInspectTab volumeName={row.name} />;
	}

	if (tab === 'summary') {
		return <VolumeSummaryPanel row={row} onRefresh={onRefresh} />;
	}

	return null;
}

export default function SwarmVolumesOverviewTable() {
	const swarm = useSwarmState();
	const connected = swarm?.connected;
	const [volumes, setVolumes] = useState<docker.SwarmVolumeInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const defaultCloneName = (base: string) => {
		const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
		return `${base}@${iso}`;
	};

	useEffect(() => {
		let active = true;

		const loadVolumes = async () => {
			if (!connected) {
				if (active) {
					setVolumes([]);
					setLoading(false);
				}
				return;
			}
			if (active) {
				setLoading(true);
			}
			try {
				const data = await GetSwarmVolumes();
				if (active) {
					setVolumes(Array.isArray(data) ? data : []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load volumes:', err);
				if (active) {
					setVolumes([]);
					setLoading(false);
				}
			}
		};

		loadVolumes();

		if (!connected) {
			return () => {
				active = false;
			};
		}

		const off = EventsOn('swarm:volumes:update', (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setVolumes(data as docker.SwarmVolumeInfo[]);
			} else {
				refresh();
			}
		});

		return () => {
			active = false;
			if (typeof off === 'function') off();
		};
	}, [connected, refreshKey, refresh]);

	if (!connected) {
		return (
			<div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
				Not connected to Docker Swarm
			</div>
		);
	}

	if (loading) {
		return <div className="main-panel-loading">Loading Swarm volumes...</div>;
	}

	return (
		<OverviewTableWithPanel
			title="Swarm Volumes"
			columns={columns}
			data={volumes}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
			createPlatform="swarm"
			createKind="volume"
			tableTestId="swarm-volumes-table"
			getRowActions={(row) => ([
				{
					label: 'Backup',
					icon: '💾',
					onClick: async () => {
						try {
							const saved = await BackupSwarmVolume(row.name);
							if (!saved) return;
							showSuccess(`Backed up volume "${row.name}"`);
						} catch (err) {
							showError(`Failed to back up volume: ${err}`);
						}
					},
				},
				{
					label: 'Restore…',
					icon: '♻️',
					onClick: async () => {
						if (!window.confirm(`Restore a backup into volume "${row.name}"? This may overwrite files.`)) return;
						try {
							const selected = await RestoreSwarmVolume(row.name);
							if (!selected) return;
							showSuccess(`Restored backup into volume "${row.name}"`);
						} catch (err) {
							showError(`Failed to restore volume: ${err}`);
						}
					},
				},
				{
					label: 'Clone…',
					icon: '🧬',
					onClick: async () => {
						const newName = window.prompt('New volume name', defaultCloneName(row.name));
						if (!newName) return;
						try {
							await CloneSwarmVolume(row.name, newName);
							showSuccess(`Cloned volume to "${newName}"`);
							refresh();
						} catch (err) {
							showError(`Failed to clone volume: ${err}`);
						}
					},
				},
				{
					label: 'Delete',
					icon: '🗑️',
					danger: true,
					onClick: async () => {
						if (!window.confirm(`Delete volume "${row.name}"?`)) return;
						try {
							await RemoveSwarmVolume(row.name, false);
							showSuccess(`Volume "${row.name}" deleted`);
							refresh();
						} catch (err) {
							showError(`Failed to delete volume: ${err}`);
						}
					},
				},
			])}
		/>
	);
}

