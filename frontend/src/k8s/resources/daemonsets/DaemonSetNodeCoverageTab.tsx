import { useEffect, useState } from 'react';
import type { app } from '../../../../wailsjs/go/models';
import * as AppAPI from '../../../../wailsjs/go/main/App';

type DaemonSetNodeCoverageTabProps = {
	namespace?: string;
	daemonSetName?: string;
};

export default function DaemonSetNodeCoverageTab({ namespace, daemonSetName }: DaemonSetNodeCoverageTabProps) {
	const [data, setData] = useState<app.DaemonSetNodeCoverage | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!namespace || !daemonSetName) return;
		let cancelled = false;
		const run = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await AppAPI.GetDaemonSetNodeCoverage(namespace, daemonSetName);
				if (!cancelled) setData(res);
			} catch (e: unknown) {
				if (!cancelled) setError((e as Error)?.message || String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		run();
		return () => { cancelled = true; };
	}, [namespace, daemonSetName]);

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	const nodes = data?.nodes || [];

	return (
		<div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
			{nodes.length === 0 ? (
				<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No nodes found.</div>
			) : (
				<table className="panel-table">
					<thead>
						<tr>
							<th>Node</th>
							<th>Coverage</th>
							<th>Pod</th>
							<th>Status</th>
							<th>Ready</th>
						</tr>
					</thead>
					<tbody>
						{nodes.map((n, idx) => {
							const node = n.node;
							const hasPod = !!n.hasPod;
							const podName = n.podName;
							const podStatus = n.podStatus;
							const ready = n.ready;
							return (
								<tr key={node || idx}>
									<td>{node}</td>
									<td style={{ color: hasPod ? '#2ea44f' : '#f85149', fontWeight: 600 }}>
										{hasPod ? 'Covered' : 'Missing'}
									</td>
									<td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>
										{podName || '-'}
									</td>
									<td>{podStatus || '-'}</td>
									<td>{ready || '-'}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}
