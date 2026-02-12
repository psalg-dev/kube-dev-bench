/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-unsafe-optional-chaining */
import { useEffect, useMemo, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { formatDateDMY } from '../../../utils/dateUtils';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';

type IngressTLSTabProps = {
	namespace?: string;
	ingressName?: string;
};

export default function IngressTLSTab({ namespace, ingressName }: IngressTLSTabProps) {
	const [items, setItems] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !ingressName) return;
		let cancelled = false;

		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await AppAPI.GetIngressTLSSummary(namespace, ingressName);
				if (!cancelled) setItems(Array.isArray(res) ? res : []);
			} catch (e: any) {
				if (!cancelled) setError(e?.message || String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		run();
		return () => { cancelled = true; };
	}, [namespace, ingressName]);

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	if (!items || items.length === 0) {
		return (
			<div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
				No TLS configured.
			</div>
		);
	}

	const fmt = (s: string) => {
		if (!s || s === '-') return '-';
		try {
			return formatDateDMY(s);
		} catch {
			return s;
		}
	};

	const columns = useMemo(() => ([
		{ key: 'secretName', label: 'Secret' },
		{ key: 'hosts', label: 'Hosts' },
		{ key: 'notAfter', label: 'Expires' },
		{ key: 'daysRemaining', label: 'Days' },
	]), []);
	const defaultSortKey = useMemo(() => pickDefaultSortKey(columns), [columns]);
	const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>(() => ({ key: defaultSortKey, direction: 'asc' }));
	const sortedItems = useMemo(() => {
		return sortRows(items, sortState.key, sortState.direction, (row, key) => {
			if (key === 'secretName') return row?.secretName ?? row?.SecretName;
			if (key === 'hosts') return Array.isArray(row?.hosts ?? row?.Hosts) ? (row?.hosts ?? row?.Hosts).join(', ') : row?.hosts ?? row?.Hosts;
			if (key === 'notAfter') return row?.notAfter ?? row?.NotAfter;
			if (key === 'daysRemaining') return row?.daysRemaining ?? row?.DaysRemaining;
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
			<table className="panel-table">
				<thead>
					<tr>
						<th aria-sort={sortState.key === 'secretName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'secretName'))}>
								<span>Secret</span>
								<span aria-hidden="true">{sortState.key === 'secretName' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'hosts' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'hosts'))}>
								<span>Hosts</span>
								<span aria-hidden="true">{sortState.key === 'hosts' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th aria-sort={sortState.key === 'notAfter' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={headerButtonStyle} onClick={() => setSortState((cur) => toggleSortState(cur, 'notAfter'))}>
								<span>Expires</span>
								<span aria-hidden="true">{sortState.key === 'notAfter' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
						<th style={{ textAlign: 'right' }} aria-sort={sortState.key === 'daysRemaining' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
							<button type="button" style={{ ...headerButtonStyle, justifyContent: 'flex-end' }} onClick={() => setSortState((cur) => toggleSortState(cur, 'daysRemaining'))}>
								<span>Days</span>
								<span aria-hidden="true">{sortState.key === 'daysRemaining' ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{sortedItems.map((t, idx) => {
						const secretName = t.secretName ?? t.SecretName ?? '-';
						const hosts = t.hosts ?? t.Hosts ?? [];
						const notAfter = t.notAfter ?? t.NotAfter ?? '-';
						const days = t.daysRemaining ?? t.DaysRemaining;
						const err = t.error ?? t.Error;
						const isExpired = typeof days === 'number' && days < 0;
						const isSoon = typeof days === 'number' && days >= 0 && days <= 14;

						return (
							<tr key={`${secretName}-${idx}`}>
								<td style={{ fontFamily: 'monospace', fontSize: 12 }}>{secretName}</td>
								<td>{Array.isArray(hosts) && hosts.length ? hosts.join(', ') : '-'}</td>
								<td style={{ color: isExpired ? '#f85149' : isSoon ? '#d29922' : 'inherit' }}>
									{err ? `Error: ${err}` : fmt(notAfter)}
								</td>
								<td style={{ textAlign: 'right', color: isExpired ? '#f85149' : isSoon ? '#d29922' : 'var(--gh-text-muted, #8b949e)' }}>
									{typeof days === 'number' ? days : '-'}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
