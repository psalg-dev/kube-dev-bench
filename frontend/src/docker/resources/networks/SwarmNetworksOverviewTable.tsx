import { useCallback, useEffect, useState } from 'react';
import type { docker } from '../../../../wailsjs/go/models';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { showError, showSuccess } from '../../../notification';
import type { QuickInfoField } from '../../../QuickInfoSection';
import QuickInfoSection from '../../../QuickInfoSection';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import {
    GetSwarmNetworkContainers,
    GetSwarmNetworks,
    GetSwarmNetworkServices,
    RemoveSwarmNetwork,
} from '../../swarmApi';
import SwarmResourceActions from '../SwarmResourceActions';
import NetworkConnectedContainersTable from './NetworkConnectedContainersTable';
import NetworkConnectedServicesTable from './NetworkConnectedServicesTable';
import { NetworkIPAMSection, NetworkOptionsSection } from './NetworkDetailsSections';
import NetworkInspectTab from './NetworkInspectTab';

type NetworkRow = docker.SwarmNetworkInfo;

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'driver', label: 'Driver' },
	{ key: 'scope', label: 'Scope', cell: ({ getValue }: { getValue: () => string }) => {
		const scope = getValue();
		const isSwarm = scope === 'swarm';
		return (
			<span style={{ color: isSwarm ? '#58a6ff' : 'inherit' }}>
				{scope}
			</span>
		);
	}},
	{ key: 'attachable', label: 'Attachable', cell: ({ getValue }: { getValue: () => boolean }) => getValue() ? 'Yes' : 'No' },
	{ key: 'internal', label: 'Internal', cell: ({ getValue }: { getValue: () => boolean }) => getValue() ? 'Yes' : 'No' },
	{ key: 'createdAt', label: 'Created', cell: ({ getValue }: { getValue: () => string }) => {
		const val = getValue();
		if (!val) return '-';
		return formatTimestampDMYHMS(val);
	}},
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary', countable: false },
	{ key: 'services', label: 'Connected Services', countKey: 'services' },
	{ key: 'containers', label: 'Containers', countKey: 'containers' },
	{ key: 'inspect', label: 'Inspect', countable: false },
];

function renderPanelContent(row: NetworkRow, tab: string, onRefresh?: () => void) {
	const quickInfoFields: QuickInfoField[] = [
		{ key: 'id', label: 'Network ID', type: 'break-word' },
		{ key: 'name', label: 'Name' },
		{ key: 'driver', label: 'Driver' },
		{ key: 'scope', label: 'Scope' },
		{ key: 'attachable', label: 'Attachable', getValue: (data: Record<string, unknown>) => (data as NetworkRow).attachable ? 'Yes' : 'No' },
		{ key: 'internal', label: 'Internal', getValue: (data: Record<string, unknown>) => (data as NetworkRow).internal ? 'Yes' : 'No' },
		{ key: 'labels', label: 'Labels', type: 'labels' },
		{ key: 'createdAt', label: 'Created', type: 'date' },
	];

	// Can't delete built-in networks
	const isBuiltIn = ['bridge', 'host', 'none', 'ingress', 'docker_gwbridge'].includes(row.name);

	const handleDelete = async () => {
		try {
			await RemoveSwarmNetwork(row.id);
			showSuccess(`Network ${row.name} removed`);
			onRefresh?.();
		} catch (err) {
			showError(`Failed to remove network: ${err}`);
		}
	};

	if (tab === 'summary') {
		return (
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row.name}
					labels={row.labels}
					actions={
						!isBuiltIn && (
							<SwarmResourceActions
								resourceType="network"
								name={row.name}
								onDelete={handleDelete}
							/>
						)
					}
				/>
				<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
					<QuickInfoSection
						resourceName={row.name}
						data={row}
						loading={false}
						error={null}
						fields={quickInfoFields}
					/>
					{/* Middle column: Connected Services */}
					<div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
						<div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
							<NetworkConnectedServicesTable networkId={row.id} compact />
						</div>
						{/* Right column: Options and IPAM */}
						<div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
							<NetworkOptionsSection options={row.options} />
							<NetworkIPAMSection ipam={row.ipam} />
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (tab === 'services') {
		return <NetworkConnectedServicesTable networkId={row.id} />;
	}

	if (tab === 'containers') {
		return <NetworkConnectedContainersTable networkId={row.id} />;
	}

	if (tab === 'inspect') {
		return <NetworkInspectTab networkId={row.id} />;
	}

	return null;
}

export default function SwarmNetworksOverviewTable() {
	const [networks, setNetworks] = useState<NetworkRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey(k => k + 1);
	}, []);

	const fetchTabCountsForRow = useCallback(async (row: NetworkRow): Promise<Record<string, number>> => {
		if (!row?.id) return { services: 0, containers: 0 };
		const [services, containers] = await Promise.all([
			GetSwarmNetworkServices(row.id),
			GetSwarmNetworkContainers(row.id),
		]);
		return {
			services: Array.isArray(services) ? services.length : 0,
			containers: Array.isArray(containers) ? containers.length : 0,
		};
	}, []);

	useEffect(() => {
		let active = true;

		const loadNetworks = async () => {
			try {
				const data = await GetSwarmNetworks();
				if (active) {
					setNetworks(data || []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load networks:', err);
				if (active) {
					setNetworks([]);
					setLoading(false);
				}
			}
		};

		loadNetworks();

		const off = EventsOn('swarm:networks:update', (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setNetworks(data);
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
		return <div className="main-panel-loading">Loading networks...</div>;
	}

	return (
		<OverviewTableWithPanel
			title="Docker Networks"
			columns={columns}
			data={networks}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, refresh)}
			tabCountsFetcher={fetchTabCountsForRow}
			createPlatform="swarm"
			createKind="network"
			tableTestId="swarm-networks-table"
			getRowActions={(row) => {
				const isBuiltIn = ['bridge', 'host', 'none', 'ingress', 'docker_gwbridge'].includes(row.name);
				return [
					{
						label: 'Delete',
						icon: '🗑️',
						danger: true,
						disabled: isBuiltIn,
						onClick: async () => {
							if (isBuiltIn) return;
							if (!window.confirm(`Delete network "${row.name}"?`)) return;
							try {
								await RemoveSwarmNetwork(row.id);
								showSuccess(`Network ${row.name} removed`);
								refresh();
							} catch (err) {
								showError(`Failed to remove network: ${err}`);
							}
						},
					},
				];
			}}
		/>
	);
}

