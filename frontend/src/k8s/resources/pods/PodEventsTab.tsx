import { useEffect, useMemo, useState } from 'react';
import { GetPodEvents } from '../../../../wailsjs/go/main/App';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type PodEventsTabProps = {
	namespace?: string;
	podName: string;
};

export default function PodEventsTab({ namespace, podName }: PodEventsTabProps) {
	const [events, setEvents] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		if (!podName) return;
		setLoading(true);
		setError(null);
		try {
			const res = await GetPodEvents(namespace || '', podName);
			setEvents(Array.isArray(res) ? res : []);
		} catch (e) {
			setError(String(e));
		} finally {
			setLoading(false);
		}
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { load(); }, [namespace, podName]);

	const columns = useMemo(() => ([
		{ key: 'type', label: 'Type' },
		{ key: 'reason', label: 'Reason' },
		{ key: 'message', label: 'Message' },
		{ key: 'count', label: 'Count' },
		{ key: 'lastTimestamp', label: 'Last Seen' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => ({ key: defaultSortKey, direction: 'asc' }));
	const sortedEvents = useMemo(() => sortRows(events, sortState.key, sortState.direction), [events, sortState]);

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
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-sidebar, #161b22)' }}>
				<span style={{ color: 'var(--gh-text, #c9d1d9)' }}>Events for {podName}</span>
				<div style={{ display: 'flex', gap: 8 }}>
					<button onClick={load} style={{ padding: '6px 10px', background: 'var(--gh-input-bg, #21262d)', border: '1px solid var(--gh-border, #30363d)', color: 'var(--gh-text, #c9d1d9)', cursor: 'pointer' }}>Refresh</button>
				</div>
			</div>
			{loading && <div style={{ padding: 12, color: 'var(--gh-text-muted, #8b949e)' }}>Loading…</div>}
			{error && <div style={{ padding: 12, color: '#f85149' }}>Error: {error}</div>}
			{!loading && !error && (
				<div style={{ flex: 1, overflow: 'auto' }}>
					<table className="panel-table">
						<thead>
							<tr>
								<th aria-sort={sortState.key === 'type' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
									<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'type'))}>
										<span>Type</span>
										<span aria-hidden="true">{sortState.key === 'type' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
									</button>
								</th>
								<th aria-sort={sortState.key === 'reason' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
									<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'reason'))}>
										<span>Reason</span>
										<span aria-hidden="true">{sortState.key === 'reason' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
									</button>
								</th>
								<th aria-sort={sortState.key === 'message' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
									<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'message'))}>
										<span>Message</span>
										<span aria-hidden="true">{sortState.key === 'message' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
									</button>
								</th>
								<th style={{ textAlign: 'right' }} aria-sort={sortState.key === 'count' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
									<button type="button" style={{ ...headerButtonStyle, justifyContent: 'flex-end' }} onClick={() => setSortState((cur) => toggleSortState(cur, 'count'))}>
										<span>Count</span>
										<span aria-hidden="true">{sortState.key === 'count' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
									</button>
								</th>
								<th aria-sort={sortState.key === 'lastTimestamp' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
									<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'lastTimestamp'))}>
										<span>Last Seen</span>
										<span aria-hidden="true">{sortState.key === 'lastTimestamp' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							{events.length === 0 && (
								<tr>
									<td colSpan={5} style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No events.</td>
								</tr>
							)}
							{sortedEvents.map((e, idx) => (
								<tr key={idx}>
									<td>{e.type}</td>
									<td>{e.reason}</td>
									<td style={{ whiteSpace: 'pre-wrap' }}>{e.message}</td>
									<td style={{ textAlign: 'right' }}>{e.count}</td>
									<td>{formatTimestampDMYHMS(e.lastTimestamp)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
