/* eslint-disable react-hooks/rules-of-hooks */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { pickDefaultSortKey, sortRows, toggleSortState } from '../../../utils/tableSorting';
import type { app } from '../../../../wailsjs/go/models';

type IngressDetailTabProps = {
	namespace?: string;
	ingressName?: string;
};

type SortState = { key: string; direction: 'asc' | 'desc' };

export default function IngressDetailTab({ namespace, ingressName }: IngressDetailTabProps) {
	const [detail, setDetail] = useState<app.IngressDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !ingressName) return;

		setLoading(true);
		setError(null);

		AppAPI.GetIngressDetail(namespace, ingressName)
			.then((data) => {
				setDetail(data);
				setLoading(false);
			})
			.catch((err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				setError(message || 'Failed to fetch ingress details');
				setLoading(false);
			});
	}, [namespace, ingressName]);

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	const ruleColumns = useMemo(() => ([
		{ key: 'host', label: 'Host' },
		{ key: 'path', label: 'Path' },
		{ key: 'pathType', label: 'Path Type' },
		{ key: 'serviceName', label: 'Service' },
		{ key: 'servicePort', label: 'Port' },
	]), []);
	const defaultRuleSortKey = useMemo(() => pickDefaultSortKey(ruleColumns), [ruleColumns]);
	const [ruleSortState, setRuleSortState] = useState<SortState>(() => ({ key: defaultRuleSortKey, direction: 'asc' }));
	const sortedRules = useMemo<app.IngressRule[]>(
		() => sortRows(detail?.rules || [], ruleSortState.key, ruleSortState.direction),
		[detail?.rules, ruleSortState]
	);

	const tlsColumns = useMemo(() => ([
		{ key: 'hosts', label: 'Hosts' },
		{ key: 'secretName', label: 'Secret' },
	]), []);
	const defaultTlsSortKey = useMemo(() => pickDefaultSortKey(tlsColumns), [tlsColumns]);
	const [tlsSortState, setTlsSortState] = useState<SortState>(() => ({ key: defaultTlsSortKey, direction: 'asc' }));
	const sortedTls = useMemo<app.IngressTLSInfo[]>(() => {
		return sortRows(detail?.tls || [], tlsSortState.key, tlsSortState.direction, (row, key) => {
			if (key === 'hosts') return Array.isArray(row?.hosts) ? row.hosts.join(', ') : row?.hosts;
			if (key === 'secretName') return row?.secretName;
			const value = (row as unknown as Record<string, unknown>)[key];
			return value;
		});
	}, [detail?.tls, tlsSortState]);

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
			{/* Routes section */}
			<h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>Routing Rules</h4>
			{!detail?.rules || detail.rules.length === 0 ? (
				<div style={{ color: 'var(--gh-text-muted, #8b949e)', marginBottom: 20 }}>No routing rules defined.</div>
			) : (
				<table className="panel-table" style={{ marginBottom: 24 }}>
					<thead>
						<tr>
							<th aria-sort={ruleSortState.key === 'host' ? (ruleSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setRuleSortState((cur) => toggleSortState(cur, 'host'))}>
									<span>Host</span>
									<span aria-hidden="true">{ruleSortState.key === 'host' ? (ruleSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={ruleSortState.key === 'path' ? (ruleSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setRuleSortState((cur) => toggleSortState(cur, 'path'))}>
									<span>Path</span>
									<span aria-hidden="true">{ruleSortState.key === 'path' ? (ruleSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={ruleSortState.key === 'pathType' ? (ruleSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setRuleSortState((cur) => toggleSortState(cur, 'pathType'))}>
									<span>Path Type</span>
									<span aria-hidden="true">{ruleSortState.key === 'pathType' ? (ruleSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={ruleSortState.key === 'serviceName' ? (ruleSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setRuleSortState((cur) => toggleSortState(cur, 'serviceName'))}>
									<span>Service</span>
									<span aria-hidden="true">{ruleSortState.key === 'serviceName' ? (ruleSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={ruleSortState.key === 'servicePort' ? (ruleSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setRuleSortState((cur) => toggleSortState(cur, 'servicePort'))}>
									<span>Port</span>
									<span aria-hidden="true">{ruleSortState.key === 'servicePort' ? (ruleSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						{sortedRules.map((rule, idx) => (
							<tr key={idx}>
								<td>
									{rule.host ? (
										<a
											href={`https://${rule.host}${rule.path || ''}`}
											target="_blank"
											rel="noopener noreferrer"
											style={{ color: '#58a6ff', textDecoration: 'none' }}
										>
											{rule.host}
										</a>
									) : (
										<span className="text-muted">*</span>
									)}
								</td>
								<td style={{ fontFamily: 'monospace' }}>
									{rule.path || '/'}
								</td>
								<td>
									<span style={{
										fontSize: 11,
										padding: '2px 6px',
										borderRadius: 3,
										backgroundColor: '#21262d',
										color: 'var(--gh-text-muted, #8b949e)'
									}}>
										{rule.pathType}
									</span>
								</td>
								<td style={{ color: '#58a6ff', fontFamily: 'monospace' }}>
									{rule.serviceName}
								</td>
								<td>
									{rule.servicePort}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{/* TLS section */}
			<h4 style={{ color: 'var(--gh-text, #c9d1d9)', marginBottom: 12 }}>TLS Configuration</h4>
			{!detail?.tls || detail.tls.length === 0 ? (
				<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>
					<span style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 8,
						padding: '8px 12px',
						backgroundColor: '#f8514920',
						border: '1px solid #f8514940',
						borderRadius: 4
					}}>
						<span>⚠️</span>
						<span>No TLS configured - traffic is not encrypted</span>
					</span>
				</div>
			) : (
				<table className="panel-table">
					<thead>
						<tr>
							<th aria-sort={tlsSortState.key === 'hosts' ? (tlsSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setTlsSortState((cur) => toggleSortState(cur, 'hosts'))}>
									<span>Hosts</span>
									<span aria-hidden="true">{tlsSortState.key === 'hosts' ? (tlsSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
							<th aria-sort={tlsSortState.key === 'secretName' ? (tlsSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
								<button type="button" style={headerButtonStyle} onClick={() => setTlsSortState((cur) => toggleSortState(cur, 'secretName'))}>
									<span>Secret</span>
									<span aria-hidden="true">{tlsSortState.key === 'secretName' ? (tlsSortState.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						{sortedTls.map((tls, idx) => (
							<tr key={idx}>
								<td>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
										{Array.isArray(tls.hosts) && tls.hosts.map((host: string, hidx: number) => (
											<span
												key={hidx}
												style={{
													padding: '2px 8px',
													backgroundColor: '#23863620',
													border: '1px solid #23863640',
													borderRadius: 4,
													color: '#2ea44f',
													fontSize: 12
												}}
											>
												🔒 {host}
											</span>
										))}
									</div>
								</td>
								<td style={{ color: '#58a6ff', fontFamily: 'monospace' }}>
									{tls.secretName || '-'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}

export { IngressDetailTab };
