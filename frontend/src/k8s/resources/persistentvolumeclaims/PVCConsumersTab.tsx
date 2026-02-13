/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type PVCConsumersTabProps = {
	namespace?: string;
	pvcName?: string;
};

export default function PVCConsumersTab({ namespace, pvcName }: PVCConsumersTabProps) {
	const [items, setItems] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !pvcName) return;
		let cancelled = false;

		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await AppAPI.GetPVCConsumers(namespace, pvcName);
				if (!cancelled) setItems(Array.isArray(res) ? res : []);
			} catch (e: any) {
				if (!cancelled) setError(e?.message || String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		run();
		return () => { cancelled = true; };
	}, [namespace, pvcName]);

	const handleRowClick = (consumer: any) => {
		const podName = consumer.podName ?? consumer.PodName;
		if (podName) {
			navigateToResource({ resource: 'Pod', name: podName, namespace });
		}
	};

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	if (!items || items.length === 0) {
		const emptyMsg = getEmptyTabMessage('consumers');
		return (
			<EmptyTabContent
				icon={emptyMsg.icon}
				title={emptyMsg.title}
				description={emptyMsg.description}
				tip={emptyMsg.tip}
			/>
		);
	}

	const columns = useMemo(() => ([
		{ key: 'podName', label: 'Pod' },
		{ key: 'node', label: 'Node' },
		{ key: 'status', label: 'Status' },
		{ key: 'refType', label: 'Reference' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => ({ key: defaultSortKey, direction: 'asc' }));
	const sortedItems = useMemo(() => {
		return sortRows(items, sortState.key, sortState.direction, (row, key) => {
			if (key === 'podName') return row?.podName ?? row?.PodName;
			if (key === 'node') return row?.node ?? row?.Node;
			if (key === 'status') return row?.status ?? row?.Status;
			if (key === 'refType') return row?.refType ?? row?.RefType;
			return row?.[key];
		});
	}, [items, sortState]);

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
		<div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
			<style>{`
				.consumers-table tbody tr {
					cursor: pointer;
					transition: background-color 0.15s ease;
				}
				.consumers-table tbody tr:hover td {
					background-color: var(--gh-hover-bg, rgba(177, 186, 196, 0.12));
				}
				.consumers-table .resource-link {
					color: var(--gh-link, #58a6ff);
				}
				.consumers-table tbody tr:hover .resource-link {
					text-decoration: underline;
				}
			`}</style>
			<table className="panel-table consumers-table">
				<thead>
					<tr>
						<th aria-sort={sortState.key === 'podName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'podName'))}>
								<span>Pod</span>
								<span aria-hidden="true">{sortState.key === 'podName' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'node' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'node'))}>
								<span>Node</span>
								<span aria-hidden="true">{sortState.key === 'node' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'status' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'status'))}>
								<span>Status</span>
								<span aria-hidden="true">{sortState.key === 'status' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'refType' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'refType'))}>
								<span>Reference</span>
								<span aria-hidden="true">{sortState.key === 'refType' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{sortedItems.map((c, idx) => (
						<tr
							key={`${c.podName || c.PodName}-${idx}`}
							onClick={() => handleRowClick(c)}
							title={`Open Pod: ${c.podName ?? c.PodName}`}
						>
							<td className="resource-link" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.podName ?? c.PodName}</td>
							<td className="text-muted">{c.node ?? c.Node ?? '-'}</td>
							<td>{c.status ?? c.Status ?? '-'}</td>
							<td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.refType ?? c.RefType ?? '-'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
