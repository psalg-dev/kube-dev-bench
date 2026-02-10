import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import StatusBadge from '../../../components/StatusBadge';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type PodRow = {
	name: string;
	status?: string;
	ready?: string | number;
	restarts?: number;
	age?: string;
	node?: string;
};

type ReplicaSetDetail = {
	ownerName?: string;
	ownerKind?: string;
	pods?: PodRow[];
};

type ReplicaSetDetailTabProps = {
	namespace?: string;
	replicaSetName?: string;
};

export default function ReplicaSetDetailTab({ namespace, replicaSetName }: ReplicaSetDetailTabProps) {
	const [detail, setDetail] = useState<ReplicaSetDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !replicaSetName) return;

		setLoading(true);
		setError(null);

		AppAPI.GetReplicaSetDetail(namespace, replicaSetName)
			.then((data) => {
				setDetail(data as ReplicaSetDetail);
				setLoading(false);
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : 'Failed to fetch replicaset details');
				setLoading(false);
			});
	}, [namespace, replicaSetName]);

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	const columns = useMemo(() => ([
		{ key: 'name', label: 'Name' },
		{ key: 'status', label: 'Status' },
		{ key: 'ready', label: 'Ready' },
		{ key: 'restarts', label: 'Restarts' },
		{ key: 'age', label: 'Age' },
		{ key: 'node', label: 'Node' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(
		() => ({ key: defaultSortKey, direction: 'asc' })
	);
	const sortedPods = useMemo(() => sortRows(detail?.pods || [], sortState.key, sortState.direction), [detail?.pods, sortState]);

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
		<div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
			{/* Owner info */}
			{detail?.ownerName && (
				<div style={{
					marginBottom: 16,
					padding: 12,
					backgroundColor: '#161b22',
					border: '1px solid #30363d',
					borderRadius: 6,
					display: 'flex',
					alignItems: 'center',
					gap: 12
				}}>
					<span style={{ color: 'var(--gh-text-muted, #8b949e)' }}>Controlled by:</span>
					<span style={{
						padding: '4px 8px',
						backgroundColor: '#21262d',
						borderRadius: 4,
						display: 'flex',
						alignItems: 'center',
						gap: 6
					}}>
						<span style={{
							fontSize: 11,
							padding: '1px 4px',
							borderRadius: 2,
							backgroundColor: '#58a6ff20',
							color: '#58a6ff'
						}}>
							{detail.ownerKind}
						</span>
						<span style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>
							{detail.ownerName}
						</span>
					</span>
				</div>
			)}

			{/* Pods section */}
			<h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>
				Pods ({detail?.pods?.length || 0})
			</h4>

			{!detail?.pods || detail.pods.length === 0 ? (
				<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No pods found for this ReplicaSet.</div>
			) : (
				<table className="panel-table">
					<thead>
						<tr>
							<th aria-sort={sortState.key === 'name' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'name'))}>
									<span>Name</span>
									<span aria-hidden="true">{sortState.key === 'name' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'status' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'status'))}>
									<span>Status</span>
									<span aria-hidden="true">{sortState.key === 'status' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'ready' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'ready'))}>
									<span>Ready</span>
									<span aria-hidden="true">{sortState.key === 'ready' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'restarts' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'restarts'))}>
									<span>Restarts</span>
									<span aria-hidden="true">{sortState.key === 'restarts' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'age' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'age'))}>
									<span>Age</span>
									<span aria-hidden="true">{sortState.key === 'age' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'node' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'node'))}>
									<span>Node</span>
									<span aria-hidden="true">{sortState.key === 'node' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						{sortedPods.map((pod, idx) => (
							<tr key={pod.name || idx}>
								<td style={{ fontFamily: 'monospace', fontSize: 12 }}>
									{pod.name}
								</td>
								<td>
									<StatusBadge status={pod.status || '-'} size="small" showDot={false} />
								</td>
								<td>{pod.ready}</td>
								<td style={{ color: (pod.restarts ?? 0) > 0 ? '#f85149' : 'inherit' }}>
									{pod.restarts ?? '-'}
								</td>
								<td>{pod.age}</td>
								<td className="text-muted">{pod.node || '-'}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}

export { ReplicaSetDetailTab };

