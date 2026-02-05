import { useMemo, useState } from 'react';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type PVAnnotationsTabProps = {
	annotations?: Record<string, string> | null;
};

export default function PVAnnotationsTab({ annotations }: PVAnnotationsTabProps) {
	const ann = annotations || {};
	const entries = Object.entries(ann).map(([key, value]) => ({ key, value }));

	if (!entries.length) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>No annotations.</div>;
	}

	const columns = useMemo(() => ([
		{ key: 'key', label: 'Key' },
		{ key: 'value', label: 'Value' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => ({ key: defaultSortKey, direction: 'asc' }));
	const sortedEntries = useMemo(() => sortRows(entries, sortState.key, sortState.direction), [entries, sortState]);

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
			<table className="panel-table">
				<thead>
					<tr>
						<th style={{ width: 320 }} aria-sort={sortState.key === 'key' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'key'))}>
								<span>Key</span>
								<span aria-hidden="true">{sortState.key === 'key' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'value' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'value'))}>
								<span>Value</span>
								<span aria-hidden="true">{sortState.key === 'value' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{sortedEntries.map(({ key, value }) => (
						<tr key={key}>
							<td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', verticalAlign: 'top' }}>{key}</td>
							<td style={{ wordBreak: 'break-all' }}>{String(value ?? '') || '-'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
