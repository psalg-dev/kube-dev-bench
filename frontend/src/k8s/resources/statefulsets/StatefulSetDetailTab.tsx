import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import StatusBadge from '../../../components/StatusBadge';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type PodRow = {
	name: string;
	status?: string;
	ready?: string | number;
	restarts?: string | number;
	age?: string;
	node?: string;
};

type PvcRow = {
	name: string;
	status?: string;
	capacity?: string;
	accessModes?: string;
	storageClass?: string;
	age?: string;
};

type StatefulSetDetail = {
	pods?: PodRow[];
	pvcs?: PvcRow[];
};

type StatefulSetDetailTabProps = {
	namespace?: string;
	statefulSetName?: string;
};

export default function StatefulSetDetailTab({ namespace, statefulSetName }: StatefulSetDetailTabProps) {
	const [detail, setDetail] = useState<StatefulSetDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSection, setActiveSection] = useState('pods');

	useEffect(() => {
		if (!namespace || !statefulSetName) return;

		setLoading(true);
		setError(null);

		AppAPI.GetStatefulSetDetail(namespace, statefulSetName)
			.then((data) => {
				setDetail(data as StatefulSetDetail);
				setLoading(false);
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : 'Failed to fetch statefulset details');
				setLoading(false);
			});
	}, [namespace, statefulSetName]);

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	const podColumns = useMemo(() => ([
		{ key: 'name', label: 'Name' },
		{ key: 'status', label: 'Status' },
		{ key: 'ready', label: 'Ready' },
		{ key: 'restarts', label: 'Restarts' },
		{ key: 'age', label: 'Age' },
		{ key: 'node', label: 'Node' },
	]), []);
	const defaultPodSortKey = useMemo(() => pickDefaultSortKey(podColumns), [podColumns]);
	const [podSortState, setPodSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(
		() => ({ key: defaultPodSortKey, direction: 'asc' })
	);
	const sortedPods = useMemo(() => sortRows(detail?.pods || [], podSortState.key, podSortState.direction), [detail?.pods, podSortState]);

	const pvcColumns = useMemo(() => ([
		{ key: 'name', label: 'Name' },
		{ key: 'status', label: 'Status' },
		{ key: 'capacity', label: 'Capacity' },
		{ key: 'accessModes', label: 'Access Modes' },
		{ key: 'storageClass', label: 'Storage Class' },
		{ key: 'age', label: 'Age' },
	]), []);
	const defaultPvcSortKey = useMemo(() => pickDefaultSortKey(pvcColumns), [pvcColumns]);
	const [pvcSortState, setPvcSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(
		() => ({ key: defaultPvcSortKey, direction: 'asc' })
	);
	const sortedPvcs = useMemo(() => sortRows(detail?.pvcs || [], pvcSortState.key, pvcSortState.direction), [detail?.pvcs, pvcSortState]);

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
			{/* Section tabs */}
			<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
				{['pods', 'pvcs'].map(section => (
					<button
						key={section}
						onClick={() => setActiveSection(section)}
						style={{
							padding: '6px 12px',
							backgroundColor: activeSection === section ? '#238636' : '#21262d',
							border: '1px solid #30363d',
							borderRadius: 4,
							color: 'var(--gh-text, #c9d1d9)',
							cursor: 'pointer',
							textTransform: 'uppercase',
							fontSize: 13
						}}
					>
						{section}
						{section === 'pods' && detail?.pods && ` (${detail.pods.length})`}
						{section === 'pvcs' && detail?.pvcs && ` (${detail.pvcs.length})`}
					</button>
				))}
			</div>

			{/* Pods section */}
			{activeSection === 'pods' && (
				<>
					{!detail?.pods || detail.pods.length === 0 ? (
						<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No pods found.</div>
					) : (
						<table className="panel-table">
							<thead>
								<tr>
									<th aria-sort={podSortState.key === 'name' ? (podSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPodSortState((cur) => toggleSortState(cur, 'name'))}>
											<span>Name</span>
											<span aria-hidden="true">{podSortState.key === 'name' ? (podSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={podSortState.key === 'status' ? (podSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPodSortState((cur) => toggleSortState(cur, 'status'))}>
											<span>Status</span>
											<span aria-hidden="true">{podSortState.key === 'status' ? (podSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={podSortState.key === 'ready' ? (podSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPodSortState((cur) => toggleSortState(cur, 'ready'))}>
											<span>Ready</span>
											<span aria-hidden="true">{podSortState.key === 'ready' ? (podSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={podSortState.key === 'restarts' ? (podSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPodSortState((cur) => toggleSortState(cur, 'restarts'))}>
											<span>Restarts</span>
											<span aria-hidden="true">{podSortState.key === 'restarts' ? (podSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={podSortState.key === 'age' ? (podSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPodSortState((cur) => toggleSortState(cur, 'age'))}>
											<span>Age</span>
											<span aria-hidden="true">{podSortState.key === 'age' ? (podSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={podSortState.key === 'node' ? (podSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPodSortState((cur) => toggleSortState(cur, 'node'))}>
											<span>Node</span>
											<span aria-hidden="true">{podSortState.key === 'node' ? (podSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedPods.map((pod, idx) => (
									<tr key={pod.name || idx}>
										<td style={{ fontFamily: 'monospace' }}>{pod.name}</td>
										<td>
											<StatusBadge status={pod.status || '-'} size="small" showDot={false} />
										</td>
										<td>{pod.ready}</td>
										<td>{pod.restarts}</td>
										<td>{pod.age}</td>
										<td className="text-muted">{pod.node || '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</>
			)}

			{/* PVCs section */}
			{activeSection === 'pvcs' && (
				<>
					{!detail?.pvcs || detail.pvcs.length === 0 ? (
						<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No PVCs found for this StatefulSet.</div>
					) : (
						<table className="panel-table">
							<thead>
								<tr>
									<th aria-sort={pvcSortState.key === 'name' ? (pvcSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPvcSortState((cur) => toggleSortState(cur, 'name'))}>
											<span>Name</span>
											<span aria-hidden="true">{pvcSortState.key === 'name' ? (pvcSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={pvcSortState.key === 'status' ? (pvcSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPvcSortState((cur) => toggleSortState(cur, 'status'))}>
											<span>Status</span>
											<span aria-hidden="true">{pvcSortState.key === 'status' ? (pvcSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={pvcSortState.key === 'capacity' ? (pvcSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPvcSortState((cur) => toggleSortState(cur, 'capacity'))}>
											<span>Capacity</span>
											<span aria-hidden="true">{pvcSortState.key === 'capacity' ? (pvcSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={pvcSortState.key === 'accessModes' ? (pvcSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPvcSortState((cur) => toggleSortState(cur, 'accessModes'))}>
											<span>Access Modes</span>
											<span aria-hidden="true">{pvcSortState.key === 'accessModes' ? (pvcSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={pvcSortState.key === 'storageClass' ? (pvcSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPvcSortState((cur) => toggleSortState(cur, 'storageClass'))}>
											<span>Storage Class</span>
											<span aria-hidden="true">{pvcSortState.key === 'storageClass' ? (pvcSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
									<th aria-sort={pvcSortState.key === 'age' ? (pvcSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" style={headerButtonStyle} onClick={() => setPvcSortState((cur) => toggleSortState(cur, 'age'))}>
											<span>Age</span>
											<span aria-hidden="true">{pvcSortState.key === 'age' ? (pvcSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
										</button>
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedPvcs.map((pvc, idx) => (
									<tr key={pvc.name || idx}>
										<td style={{ fontFamily: 'monospace' }}>{pvc.name}</td>
										<td>
											<StatusBadge status={pvc.status || '-'} size="small" showDot={false} />
										</td>
										<td>{pvc.capacity}</td>
										<td className="text-muted">{pvc.accessModes}</td>
										<td className="text-muted">{pvc.storageClass || '-'}</td>
										<td>{pvc.age}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</>
			)}
		</div>
	);
}

export { StatefulSetDetailTab };

