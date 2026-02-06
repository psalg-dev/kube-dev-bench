import { useEffect, useState, useCallback } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../SwarmResourceActions';
import ConfigDataTab from './ConfigDataTab';
import ConfigDataSection from './ConfigDataSection';
import ConfigEditModal from './ConfigEditModal';
import ConfigInspectTab from './ConfigInspectTab';
import ConfigCompareModal from './ConfigCompareModal';
import ConfigUsedBySection from './ConfigUsedBySection';
import Button from '../../../components/ui/Button';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { CloneSwarmConfig, ExportSwarmConfig, GetSwarmConfigs, RemoveSwarmConfig } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import type { docker } from '../../../../wailsjs/go/models';

const columns = [
	{ key: 'name', label: 'Name' },
	{
		key: 'dataSize',
		label: 'Size',
		cell: ({ getValue }: { getValue: () => unknown }) => {
			const size = getValue();
			if (size === undefined || size === null) return '-';
			const numeric = Number(size);
			if (!Number.isFinite(numeric)) return '-';
			if (numeric < 1024) return `${numeric} B`;
			if (numeric < 1024 * 1024) return `${(numeric / 1024).toFixed(1)} KB`;
			return `${(numeric / 1024 / 1024).toFixed(1)} MB`;
		},
	},
	{
		key: 'createdAt',
		label: 'Created',
		cell: ({ getValue }: { getValue: () => unknown }) => formatTimestampDMYHMS(String(getValue() ?? '')),
	},
	{
		key: 'updatedAt',
		label: 'Updated',
		cell: ({ getValue }: { getValue: () => unknown }) => formatTimestampDMYHMS(String(getValue() ?? '')),
	},
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary' },
	{ key: 'data', label: 'Data' },
	{ key: 'inspect', label: 'Inspect' },
];

type ConfigSummaryPanelProps = {
	row: docker.SwarmConfigInfo;
	allConfigs: docker.SwarmConfigInfo[];
	onRefresh?: () => void;
	onEdit?: (config: docker.SwarmConfigInfo) => void;
};

function ConfigSummaryPanel({ row, allConfigs, onRefresh, onEdit }: ConfigSummaryPanelProps) {
	const [showCompare, setShowCompare] = useState(false);
	const [cloning, setCloning] = useState(false);
	const [downloading, setDownloading] = useState(false);

	const makeDefaultCloneName = () => {
		// Example: name@2026-01-06T15:30:12Z
		const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
		return `${row.name}@${iso}`;
	};

	const quickInfoFields: QuickInfoField[] = [
		{ key: 'id', label: 'Config ID', type: 'break-word' },
		{ key: 'name', label: 'Name' },
		{
			key: 'dataSize',
			label: 'Data Size',
			getValue: (d: Record<string, any>) => {
				const size = d.dataSize;
				if (size === undefined || size === null) return '-';
				if (size < 1024) return `${size} bytes`;
				if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
				return `${(size / 1024 / 1024).toFixed(1)} MB`;
			},
		},
		{ key: 'createdAt', label: 'Created', type: 'date' },
		{ key: 'updatedAt', label: 'Updated', type: 'date' },
	];

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
		const newName = window.prompt('New config name', makeDefaultCloneName());
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
						<Button size="sm" onClick={() => onEdit?.(row)}>
							Edit
						</Button>
						<Button
							id="swarm-config-compare-btn"
							size="sm"
							onClick={() => setShowCompare(true)}
						>
							Compare
						</Button>
						<Button
							id="swarm-config-download-btn"
							size="sm"
							onClick={handleDownload}
							disabled={downloading}
						>
							{downloading ? 'Downloading...' : 'Download'}
						</Button>
						<Button
							id="swarm-config-clone-btn"
							size="sm"
							onClick={handleClone}
							disabled={cloning}
						>
							{cloning ? 'Cloning...' : 'Clone'}
						</Button>
						<SwarmResourceActions
							resourceType="config"
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
				{/* Config Data + Used By sections */}
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
		</div>
	);
}

function renderPanelContent(
	row: docker.SwarmConfigInfo,
	tab: string,
	onRefresh: (() => void) | undefined,
	allConfigs: docker.SwarmConfigInfo[],
	onEdit: ((config: docker.SwarmConfigInfo) => void) | undefined
) {
	if (tab === 'summary') {
		return <ConfigSummaryPanel row={row} allConfigs={allConfigs} onRefresh={onRefresh} onEdit={onEdit} />;
	}

	if (tab === 'data') {
		return <ConfigDataTab configId={row.id} configName={row.name} />;
	}

	if (tab === 'inspect') {
		return <ConfigInspectTab configId={row.id} />;
	}

	return null;
}

export default function SwarmConfigsOverviewTable() {
	const [configs, setConfigs] = useState<docker.SwarmConfigInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);
	const [editConfig, setEditConfig] = useState<{ open: boolean; id?: string; name: string }>({ open: false, id: undefined, name: '' });

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const makeDefaultCloneName = (base: string) => {
		const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
		return `${base}@${iso}`;
	};

	useEffect(() => {
		let active = true;

		const loadConfigs = async () => {
			try {
				const data = await GetSwarmConfigs();
				if (active) {
					setConfigs(data || []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load configs:', err);
				if (active) {
					setConfigs([]);
					setLoading(false);
				}
			}
		};

		loadConfigs();

		const off = EventsOn('swarm:configs:update', (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setConfigs(data as docker.SwarmConfigInfo[]);
			} else {
				refresh();
			}
		});

		return () => {
			active = false;
			if (typeof off === 'function') off();
		};
	}, [refreshKey, refresh]);

	if (loading) {
		return <div className="main-panel-loading">Loading Swarm configs...</div>;
	}

	return (
		<>
			<OverviewTableWithPanel
				title="Swarm Configs"
				columns={columns}
				data={configs}
				tabs={bottomTabs}
				renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh, configs, (config) => setEditConfig({ open: true, id: config?.id, name: config?.name || '' }))}
				createPlatform="swarm"
				createKind="config"
				tableTestId="swarm-configs-table"
				getRowActions={(row) => ([
					{
						label: 'Download',
						icon: '⬇️',
						onClick: async () => {
							try {
								const savedPath = await ExportSwarmConfig(row.id, `${row.name}.txt`);
								if (!savedPath) return;
								showSuccess(`Saved config ${row.name}`);
							} catch (err) {
								showError(`Failed to download config: ${err}`);
							}
						},
					},
					{
						label: 'Clone…',
						icon: '🧬',
						onClick: async () => {
							const newName = window.prompt('New config name', makeDefaultCloneName(row.name));
							if (!newName) return;
							try {
								await CloneSwarmConfig(row.id, newName);
								showSuccess(`Cloned config to ${newName}`);
								refresh();
							} catch (err) {
								showError(`Failed to clone config: ${err}`);
							}
						},
					},
					{
						label: 'Delete',
						icon: '🗑️',
						danger: true,
						onClick: async () => {
							if (!window.confirm(`Delete config "${row.name}"?`)) return;
							try {
								await RemoveSwarmConfig(row.id);
								showSuccess(`Config ${row.name} removed`);
								refresh();
							} catch (err) {
								showError(`Failed to remove config: ${err}`);
							}
						},
					},
				])}
			/>
			<ConfigEditModal
				open={editConfig.open}
				configId={editConfig.id ?? undefined}
				configName={editConfig.name}
				onClose={() => setEditConfig({ open: false, id: undefined, name: '' })}
				onSaved={() => refresh()}
			/>
		</>
	);
}


