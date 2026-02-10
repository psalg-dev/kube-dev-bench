import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type SecretConsumerRow = {
	kind?: string;
	name?: string;
	refType?: string;
	Kind?: string;
	Name?: string;
	RefType?: string;
};

type SecretConsumersTabProps = {
	namespace?: string;
	secretName?: string;
};

export default function SecretConsumersTab({ namespace, secretName }: SecretConsumersTabProps) {
	const [items, setItems] = useState<SecretConsumerRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !secretName) return;
		let cancelled = false;
		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await AppAPI.GetSecretConsumers(namespace, secretName);
				if (!cancelled) setItems(Array.isArray(res) ? (res as SecretConsumerRow[]) : []);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		run();
		return () => { cancelled = true; };
	}, [namespace, secretName]);

	const handleRowClick = (consumer: SecretConsumerRow) => {
		const kind = consumer.kind ?? consumer.Kind;
		const name = consumer.name ?? consumer.Name;
		if (kind && name) {
			navigateToResource({ resource: kind, name, namespace });
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
		{ key: 'kind', label: 'Kind' },
		{ key: 'name', label: 'Name' },
		{ key: 'refType', label: 'Reference' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(
		() => ({ key: defaultSortKey, direction: 'asc' })
	);
	const sortedItems = useMemo(() => {
		return sortRows(items, sortState.key, sortState.direction, (row, key) => {
			if (key === 'kind') return row?.kind ?? row?.Kind;
			if (key === 'name') return row?.name ?? row?.Name;
			if (key === 'refType') return row?.refType ?? row?.RefType;
			return (row as unknown as Record<string, unknown>)?.[key];
		});
	}, [items, sortState]);

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
						<th aria-sort={sortState.key === 'kind' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'kind'))}>
								<span>Kind</span>
								<span aria-hidden="true">{sortState.key === 'kind' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'name' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'name'))}>
								<span>Name</span>
								<span aria-hidden="true">{sortState.key === 'name' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
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
							key={`${c.kind || c.Kind}-${c.name || c.Name}-${idx}`}
							onClick={() => handleRowClick(c)}
							title={`Open ${c.kind ?? c.Kind}: ${c.name ?? c.Name}`}
						>
							<td>{c.kind ?? c.Kind}</td>
							<td className="resource-link">{c.name ?? c.Name}</td>
							<td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.refType ?? c.RefType ?? '-'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export { SecretConsumersTab };
