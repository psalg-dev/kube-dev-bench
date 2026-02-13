import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { docker } from '../../../../wailsjs/go/models';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { navigateToResource } from '../../../utils/resourceNavigation';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';
import { GetSwarmStackResources } from '../../swarmApi';

// Mapping from resource type to empty message key
const resourceMessageMap = {
	networks: 'swarm-stack-networks',
	volumes: 'swarm-stack-volumes',
	configs: 'swarm-stack-configs',
	secrets: 'swarm-stack-secrets',
};

type StackResourceKey = keyof typeof resourceMessageMap;

type StackResourceRow = Record<string, unknown> & {
	id?: string;
	name?: string;
	createdAt?: string;
	dataSize?: number;
	driver?: string;
	scope?: string;
	attachable?: boolean;
	internal?: boolean;
};
type TableColumn = {
	key: string;
	label: string;
	width?: string;
	mono?: boolean;
	breakWord?: boolean;
	maxWidth?: number;
	render?: (_row: StackResourceRow) => ReactNode;
};

type EmptyProps = {
	resource?: StackResourceKey;
};

function Empty({ resource }: EmptyProps) {
	const messageKey = resource ? resourceMessageMap[resource] : 'data';
	const emptyMsg = getEmptyTabMessage(messageKey);
	return (
		<EmptyTabContent
			icon={emptyMsg.icon}
			title={emptyMsg.title}
			description={emptyMsg.description}
			tip={emptyMsg.tip}
		/>
	);
}
type TableProps = {
	columns: TableColumn[];
	rows: StackResourceRow[];
	rowKey: (_row: StackResourceRow) => string;
	onRowClick?: (_row: StackResourceRow) => void;
	resourceType?: StackResourceKey;
};

function Table({ columns, rows, rowKey, onRowClick, resourceType }: TableProps) {
	const [hoveredRow, setHoveredRow] = useState<string | null>(null);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(
		() => ({ key: defaultSortKey, direction: 'asc' })
	);
	const sortedRows = useMemo(() => sortRows(rows, sortState.key, sortState.direction), [rows, sortState]);

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

	return (
		<div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 16 }}>
			<table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
				<colgroup>
					{columns.map((c) => (
						<col key={c.key} style={{ width: c.width || 'auto' }} />
					))}
				</colgroup>
				<thead>
					<tr>
						{columns.map((c) => (
							<th
								key={c.key}
								aria-sort={sortState.key === c.key ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
								style={{
									textAlign: 'left',
									fontWeight: 600,
									fontSize: 12,
									color: 'var(--gh-text, #c9d1d9)',
									borderBottom: '1px solid var(--gh-border, #30363d)',
									padding: '8px 10px',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								<button
									type="button"
									style={headerButtonStyle}
									onClick={() => setSortState((cur) => toggleSortState(cur, c.key))}
								>
									<span>{c.label}</span>
									<span aria-hidden="true">{sortState.key === c.key ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{sortedRows.map((r) => {
						const key = rowKey(r);
						const isHovered = hoveredRow === key;
						const hasClickHandler = !!onRowClick;
						return (
							<tr
								key={key}
								onClick={hasClickHandler ? () => onRowClick(r) : undefined}
								onMouseEnter={() => setHoveredRow(key)}
								onMouseLeave={() => setHoveredRow(null)}
								onKeyDown={(e) => { if (hasClickHandler && (e.key === 'Enter' || e.key === ' ')) onRowClick(r); }}
								role={hasClickHandler ? 'button' : undefined}
								tabIndex={hasClickHandler ? 0 : undefined}
								title={hasClickHandler ? `Open ${resourceType}: ${String(r.name ?? '')}` : undefined}
								style={{
									cursor: hasClickHandler ? 'pointer' : 'default',
									background: isHovered && hasClickHandler ? 'var(--gh-row-hover, rgba(88, 166, 255, 0.1))' : undefined,
								}}
							>
								{columns.map((c, idx) => (
									<td
										key={c.key}
										style={{
											textAlign: 'left',
											fontSize: 12,
											color: idx === 0 && isHovered && hasClickHandler ? 'var(--gh-link, #58a6ff)' : 'var(--gh-text, #c9d1d9)',
											borderBottom: '1px solid var(--gh-border, #30363d)',
											padding: '8px 10px',
											verticalAlign: 'middle',
											wordBreak: c.breakWord ? 'break-word' : 'normal',
											fontFamily: c.mono ? 'monospace' : 'inherit',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: c.breakWord ? 'normal' : 'nowrap',
										}}
										title={String(r?.[c.key] ?? '')}
									>
										{c.render ? c.render(r) : String(r?.[c.key] ?? '-')}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

type StackResourcesTabProps = {
	stackName?: string;
	resource?: StackResourceKey;
};

export default function StackResourcesTab({ stackName, resource }: StackResourcesTabProps) {
	const [data, setData] = useState<docker.SwarmStackResources | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;

		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await GetSwarmStackResources(stackName || '');
				if (!active) return;
				setData(res || null);
			} catch (e) {
				if (!active) return;
				setError(String(e));
				setData(null);
			} finally {
				if (active) setLoading(false);
			}
		};

		load();
		return () => {
			active = false;
		};
	}, [stackName]);

	const rows = useMemo<StackResourceRow[]>(() => {
		if (!data) return [];
		switch (resource) {
			case 'networks': return (data.networks || []) as unknown as StackResourceRow[];
			case 'volumes': return (data.volumes || []) as unknown as StackResourceRow[];
			case 'configs': return (data.configs || []) as unknown as StackResourceRow[];
			case 'secrets': return (data.secrets || []) as unknown as StackResourceRow[];
			default: return [];
		}
	}, [data, resource]);

	const columns = useMemo<TableColumn[]>(() => {
		switch (resource) {
			case 'networks':
				return [
					{ key: 'name', label: 'Name', width: '25%' },
					{ key: 'driver', label: 'Driver', width: '12%' },
					{ key: 'scope', label: 'Scope', width: '10%' },
					{ key: 'attachable', label: 'Attachable', width: '10%', render: (r) => r.attachable ? 'Yes' : 'No' },
					{ key: 'internal', label: 'Internal', width: '10%', render: (r) => r.internal ? 'Yes' : 'No' },
					{ key: 'id', label: 'ID', width: '33%', mono: true, maxWidth: 300 },
				];
			case 'volumes':
				return [
					{ key: 'name', label: 'Name', width: '35%' },
					{ key: 'driver', label: 'Driver', width: '15%' },
					{ key: 'scope', label: 'Scope', width: '15%' },
					{ key: 'createdAt', label: 'Created', width: '35%', render: (r) => r.createdAt ? formatTimestampDMYHMS(r.createdAt) : '-' },
				];
			case 'configs':
				return [
					{ key: 'name', label: 'Name', width: '30%' },
					{ key: 'dataSize', label: 'Size', width: '10%', render: (r) => {
						const size = r.dataSize;
						if (size === undefined || size === null) return '-';
						if (size < 1024) return `${size} B`;
						if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
						return `${(size / 1024 / 1024).toFixed(1)} MB`;
					}},
					{ key: 'createdAt', label: 'Created', width: '25%', render: (r) => r.createdAt ? formatTimestampDMYHMS(r.createdAt) : '-' },
					{ key: 'id', label: 'ID', width: '35%', mono: true, maxWidth: 300 },
				];
			case 'secrets':
				return [
					{ key: 'name', label: 'Name', width: '30%' },
					{ key: 'createdAt', label: 'Created', width: '30%', render: (r) => r.createdAt ? formatTimestampDMYHMS(r.createdAt) : '-' },
					{ key: 'id', label: 'ID', width: '40%', mono: true, maxWidth: 300 },
				];
			default:
				return [];
		}
	}, [resource]);

	if (loading) {
		return (
			<div style={{ padding: 24, textAlign: 'center', color: 'var(--gh-text-secondary, #8b949e)' }}>
				Loading {resource}...
			</div>
		);
	}

	if (error) {
		return (
			<div style={{ padding: 24, color: '#f85149' }}>
				Failed to load {resource}: {error}
			</div>
		);
	}

	if (!rows || rows.length === 0) {
		return <Empty resource={resource} />;
	}

	const handleRowClick = (row: StackResourceRow) => {
		if (!row?.name) return;
		if (resource === 'networks') {
			navigateToResource({ resource: 'SwarmNetwork', name: String(row.name) });
			return;
		}
		if (resource === 'volumes') {
			navigateToResource({ resource: 'SwarmVolume', name: String(row.name) });
			return;
		}
		if (resource === 'configs') {
			navigateToResource({ resource: 'SwarmConfig', name: String(row.name) });
			return;
		}
		if (resource === 'secrets') {
			navigateToResource({ resource: 'SwarmSecret', name: String(row.name) });
		}
	};

	return (
		<Table
			columns={columns}
			rows={rows}
			rowKey={(r) => String(r.id || r.name || '')}
			onRowClick={handleRowClick}
			resourceType={resource}
		/>
	);
}

export { StackResourcesTab };

