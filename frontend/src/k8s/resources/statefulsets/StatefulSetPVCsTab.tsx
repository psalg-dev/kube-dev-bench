import { useEffect, useMemo, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import StatusBadge from '../../../components/StatusBadge';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';
import './StatefulSetPVCsTab.css';

type StatefulSetPVCsTabProps = {
	namespace?: string;
	statefulSetName?: string;
};

/**
 * Shows PVCs associated with a StatefulSet.
 */
export default function StatefulSetPVCsTab({ namespace, statefulSetName }: StatefulSetPVCsTabProps) {
	const [pvcs, setPvcs] = useState<unknown[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchPVCs = async (isInitial = false) => {
		if (!statefulSetName || !namespace) return;

		if (isInitial) setLoading(true);
		setError(null);

		try {
			const result = await AppAPI.GetStatefulSetDetail(namespace, statefulSetName);
			setPvcs(result?.pvcs || []);
		} catch (err: unknown) {
			setError(err?.message || String(err));
			if (isInitial) setPvcs([]);
		} finally {
			if (isInitial) setLoading(false);
		}
	};

	useEffect(() => {
		fetchPVCs(true);
		intervalRef.current = setInterval(() => fetchPVCs(false), 10000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [namespace, statefulSetName]);

	const columns = useMemo(() => ([
		{ key: 'name', label: 'Name' },
		{ key: 'status', label: 'Status' },
		{ key: 'capacity', label: 'Capacity' },
		{ key: 'accessModes', label: 'Access Modes' },
		{ key: 'storageClass', label: 'Storage Class' },
		{ key: 'podName', label: 'Pod' },
		{ key: 'age', label: 'Age' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => ({ key: defaultSortKey, direction: 'asc' }));
	const sortedPvcs = useMemo(() => sortRows(pvcs, sortState.key, sortState.direction), [pvcs, sortState]);

	if (loading) {
		return (
			<div className="statefulset-pvcs-tab">
				<div className="pvcs-loading">Loading PVCs...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="statefulset-pvcs-tab">
				<div className="pvcs-error">Error: {error}</div>
			</div>
		);
	}

	if (pvcs.length === 0) {
		return (
			<div className="statefulset-pvcs-tab">
				<div className="pvcs-empty">No PVCs found for this StatefulSet.</div>
			</div>
		);
	}

	const headerButtonStyle = {
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
		textAlign: 'left' as const,
	};

	return (
		<div className="statefulset-pvcs-tab">
			<div className="pvcs-header">
				<span className="pvcs-count">{pvcs.length} PVC{pvcs.length !== 1 ? 's' : ''}</span>
			</div>
			<div className="pvcs-list">
				<table className="pvcs-table">
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
							<th aria-sort={sortState.key === 'capacity' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'capacity'))}>
									<span>Capacity</span>
									<span aria-hidden="true">{sortState.key === 'capacity' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'accessModes' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'accessModes'))}>
									<span>Access Modes</span>
									<span aria-hidden="true">{sortState.key === 'accessModes' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'storageClass' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'storageClass'))}>
									<span>Storage Class</span>
									<span aria-hidden="true">{sortState.key === 'storageClass' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'podName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'podName'))}>
									<span>Pod</span>
									<span aria-hidden="true">{sortState.key === 'podName' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={sortState.key === 'age' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'age'))}>
									<span>Age</span>
									<span aria-hidden="true">{sortState.key === 'age' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						{sortedPvcs.map((pvc: unknown, idx: number) => {
							return (
								<tr key={idx} className="pvc-row">
									<td className="pvc-name">{pvc.name || '-'}</td>
									<td>
										<StatusBadge status={pvc.status || 'Unknown'} size="small" showDot={false} />
									</td>
									<td className="pvc-capacity">{pvc.capacity || '-'}</td>
									<td className="pvc-access">{pvc.accessModes || '-'}</td>
									<td className="pvc-storage-class">{pvc.storageClass || '-'}</td>
									<td className="pvc-pod">{pvc.podName || '-'}</td>
									<td className="pvc-age">{pvc.age || '-'}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

