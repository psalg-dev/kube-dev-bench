import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GetSwarmNetworkServices } from '../../swarmApi';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';
import type { docker } from '../../../../wailsjs/go/models';

/**
 * Displays connected services for a network in a proper datatable format.
 * @param {Object} props
 * @param {string} props.networkId - The network ID to fetch services for
 * @param {boolean} [props.compact] - If true, renders a compact version for the summary tab
 */
type NetworkServiceRef = docker.SwarmServiceRef & { aliases?: string[] };

type NetworkConnectedServicesTableProps = {
	networkId?: string;
	compact?: boolean;
};

function NetworkConnectedServicesTable({ networkId, compact = false }: NetworkConnectedServicesTableProps) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [services, setServices] = useState<NetworkServiceRef[]>([]);
	const [hoveredRow, setHoveredRow] = useState<string | null>(null);

	const columns = useMemo(() => {
		if (compact) {
			return [
				{ key: 'serviceName', label: 'Service Name' },
				{ key: 'serviceId', label: 'Service ID' },
			];
		}
		return [
			{ key: 'serviceName', label: 'Service Name' },
			{ key: 'serviceId', label: 'Service ID' },
			{ key: 'aliases', label: 'Aliases' },
		];
	}, [compact]);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => ({
		key: defaultSortKey,
		direction: 'asc',
	}));
	const sortedServices = useMemo(() => {
		return sortRows(services, sortState.key, sortState.direction, (row, key) => {
			if (key === 'aliases') return Array.isArray(row?.aliases) ? row.aliases.join(', ') : row?.aliases;
			return (row as unknown as Record<string, unknown>)?.[key];
		});
	}, [services, sortState]);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError('');

		const resolvedId = networkId;
		if (!resolvedId) {
			setServices([]);
			setLoading(false);
			return () => {
				active = false;
			};
		}

		(async () => {
			try {
				const data = await GetSwarmNetworkServices(resolvedId);
				if (!active) return;
				setServices(Array.isArray(data) ? (data as NetworkServiceRef[]) : []);
			} catch (e) {
				if (!active) return;
				setServices([]);
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (active) setLoading(false);
			}
		})();

		return () => {
			active = false;
		};
	}, [networkId]);

	const emptyMsg = getEmptyTabMessage('swarm-connected-services');

	const containerStyle: CSSProperties = {
		padding: 16,
		overflow: 'auto',
		flex: 1,
		minWidth: 0,
		display: 'flex',
		flexDirection: 'column',
	};

	const headerStyle: CSSProperties = {
		fontWeight: 600,
		color: 'var(--gh-text, #c9d1d9)',
		marginBottom: 8,
		fontSize: compact ? 13 : 14,
	};

	if (loading) {
		return (
			<div style={containerStyle}>
				<div style={headerStyle}>Connected Services</div>
				<div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
			</div>
		);
	}

	if (error) {
		return (
			<div style={containerStyle}>
				<div style={headerStyle}>Connected Services</div>
				<div style={{ color: '#f85149' }}>Failed to load services: {error}</div>
			</div>
		);
	}

	if (services.length === 0) {
		return (
			<div style={containerStyle}>
				<div style={headerStyle}>Connected Services</div>
				<EmptyTabContent
					icon={emptyMsg.icon}
					title={emptyMsg.title}
					description={emptyMsg.description}
					tip={emptyMsg.tip}
				/>
			</div>
		);
	}

	const headerButtonStyle: CSSProperties = {
		width: '100%',
		background: 'transparent',
		border: 'none',
		color: 'inherit',
		font: 'inherit',
		padding: 0,
		cursor: 'pointer',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 6,
		textAlign: 'left',
	};

	/**
	 * Handle row click - navigate to the service
	 */
	const handleRowClick = (svc: NetworkServiceRef) => {
		const serviceName = svc.serviceName || svc.serviceId;
		if (serviceName) {
			navigateToResource({ resource: 'SwarmService', name: serviceName });
		}
	};

	return (
		<div style={containerStyle}>
			<div style={headerStyle}>
				Connected Services ({services.length})
			</div>
			<div style={{ flex: 1, overflow: 'auto' }}>
				<table className="panel-table" style={{ width: '100%' }}>
					<thead>
						<tr>
							<th aria-sort={sortState.key === 'serviceName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'serviceName'))}>
									<span>Service Name</span>
									<span aria-hidden="true">{sortState.key === 'serviceName' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'serviceId' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'serviceId'))}>
									<span>Service ID</span>
									<span aria-hidden="true">{sortState.key === 'serviceId' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							{!compact && (
								<th aria-sort={sortState.key === 'aliases' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
									<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'aliases'))}>
										<span>Aliases</span>
										<span aria-hidden="true">{sortState.key === 'aliases' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
									</button>
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{sortedServices.map((svc) => {
							const hasService = !!(svc.serviceName || svc.serviceId);
							const hoverKey = svc.serviceId || svc.serviceName;
							const isHovered = hoveredRow === hoverKey;
							return (
								<tr
									key={svc.serviceId || svc.serviceName}
									onClick={() => handleRowClick(svc)}
									onMouseEnter={() => setHoveredRow(hoverKey ?? null)}
									onMouseLeave={() => setHoveredRow(null)}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRowClick(svc); }}
									role="button"
									tabIndex={hasService ? 0 : -1}
									title={hasService ? `Open service: ${svc.serviceName || svc.serviceId}` : undefined}
									style={{
										cursor: hasService ? 'pointer' : 'default',
										background: isHovered && hasService ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))' : undefined,
									}}
								>
									<td style={{ fontWeight: 500, color: hasService && isHovered ? 'var(--gh-link, #58a6ff)' : undefined }}>
										{svc.serviceName || '-'}
									</td>
									<td style={{ fontFamily: 'monospace', fontSize: 11 }}>
										{svc.serviceId ? (
											<span title={svc.serviceId}>
												{compact ? svc.serviceId.slice(0, 12) : svc.serviceId}
											</span>
										) : '-'}
									</td>
									{!compact && (
										<td>
											{svc.aliases && svc.aliases.length > 0
												? svc.aliases.join(', ')
												: '-'}
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default NetworkConnectedServicesTable;
export { NetworkConnectedServicesTable };


