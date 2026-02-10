import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import SwarmResourceActions from '../SwarmResourceActions';
import Button from '../../../components/ui/Button';
import SecretEditModal from './SecretEditModal';
import SecretCloneModal from './SecretCloneModal';
import SecretUsedBySection from './SecretUsedBySection';
import SecretDataSection from './SecretDataSection';
import SecretInspectTab from './SecretInspectTab';
import { GetSwarmSecrets, RemoveSwarmSecret } from '../../swarmApi';
import { showSuccess, showError } from '../../../notification';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import type { docker } from '../../../../wailsjs/go/models';

type SwarmSecretRow = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	labels?: Record<string, string>;
	driverName?: string;
};

type CellValueContext = {
	getValue: () => any;
};

const columns = [
	{ key: 'name', label: 'Name' },
	{
		key: 'createdAt',
		label: 'Created',
		cell: ({ getValue }: CellValueContext) => {
			const val = getValue();
			if (!val) return '-';
			return formatTimestampDMYHMS(val);
		},
	},
	{
		key: 'updatedAt',
		label: 'Updated',
		cell: ({ getValue }: CellValueContext) => {
			const val = getValue();
			if (!val) return '-';
			return formatTimestampDMYHMS(val);
		},
	},
	{
		key: 'labels',
		label: 'Labels',
		cell: ({ getValue }: CellValueContext) => {
			const labels = getValue() as Record<string, string> | undefined;
			if (!labels) return '-';
			const count = Object.keys(labels).length;
			return count > 0 ? `${count} label${count > 1 ? 's' : ''}` : '-';
		},
	},
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary' },
	{ key: 'inspect', label: 'JSON' },
];

type SecretSummaryPanelProps = {
	row: SwarmSecretRow;
	onRefresh?: () => void;
};

function SecretSummaryPanel({ row, onRefresh }: SecretSummaryPanelProps) {
	const [showEdit, setShowEdit] = useState(false);
	const [showRotate, setShowRotate] = useState(false);
	const [showClone, setShowClone] = useState(false);

	const handleDelete = async () => {
		if (!window.confirm(`Delete secret "${row.name}"?`)) return;
		try {
			await RemoveSwarmSecret(row.id);
			showSuccess(`Secret "${row.name}" deleted`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to delete secret: ${err}`);
		}
	};

	const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date'; getValue?: (d: Record<string, any>) => any }> = [
		{ key: 'id', label: 'ID', type: 'break-word' },
		{ key: 'name', label: 'Name' },
		{ key: 'createdAt', label: 'Created', type: 'date' },
		{ key: 'updatedAt', label: 'Updated', type: 'date' },
		{
			key: 'driverName',
			label: 'Driver',
			getValue: (d) => d?.driverName || '-',
		},
		{
			key: 'external',
			label: 'External',
			getValue: (d) => (d?.driverName ? 'Yes' : 'No'),
		},
	];

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row.name}
				labels={row.labels}
				actions={(
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<Button id="swarm-secret-edit-btn" size="sm" onClick={() => setShowEdit(true)}>
							Edit
						</Button>
						<Button id="swarm-secret-rotate-btn" size="sm" onClick={() => setShowRotate(true)}>
							Rotate
						</Button>
						<Button id="swarm-secret-clone-btn" size="sm" onClick={() => setShowClone(true)}>
							Clone
						</Button>
						<SwarmResourceActions
							resourceType="secret"
							name={row.name}
							onDelete={handleDelete}
						/>
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
				{/* Secret Data + Used By sections */}
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

function renderPanelContent(row: SwarmSecretRow, tab: string, onRefresh: () => void) {
	if (tab === 'summary') return <SecretSummaryPanel row={row} onRefresh={onRefresh} />;
	if (tab === 'inspect') return <SecretInspectTab secretId={row.id} />;
	return null;
}

export default function SwarmSecretsOverviewTable() {
	const swarm = useSwarmState();
	const connected = swarm?.connected;
	const [secrets, setSecrets] = useState<SwarmSecretRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	useEffect(() => {
		if (!connected) {
			setSecrets([]);
			setLoading(false);
			return;
		}

		let active = true;

		const loadSecrets = async () => {
			try {
				const data = await GetSwarmSecrets();
				if (active) {
					setSecrets(Array.isArray(data) ? (data as SwarmSecretRow[]) : []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load secrets:', err);
				if (active) {
					setSecrets([]);
					setLoading(false);
				}
			}
		};

		loadSecrets();

		const off = EventsOn('swarm:secrets:update', (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setSecrets(data as SwarmSecretRow[]);
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
		return <div className="main-panel-loading">Loading Swarm secrets...</div>;
	}

	return (
		<OverviewTableWithPanel
			title="Swarm Secrets"
			columns={columns}
			data={secrets}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
			createPlatform="swarm"
			createKind="secret"
			tableTestId="swarm-secrets-table"
			getRowActions={(row) => ([
				{
					label: 'Delete',
					icon: '🗑️',
					danger: true,
					onClick: async () => {
						if (!window.confirm(`Delete secret "${row.name}"?`)) return;
						try {
							await RemoveSwarmSecret(row.id);
							showSuccess(`Secret "${row.name}" deleted`);
							refresh();
						} catch (err) {
							showError(`Failed to delete secret: ${err}`);
						}
					},
				},
			])}
		/>
	);
}


