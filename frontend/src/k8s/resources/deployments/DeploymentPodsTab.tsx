import { useEffect, useState } from 'react';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import StatusBadge from '../../../components/StatusBadge';

type DeploymentPodsTabProps = {
	namespace: string;
	deploymentName: string;
};

export default function DeploymentPodsTab({ namespace, deploymentName }: DeploymentPodsTabProps) {
	const [detail, setDetail] = useState<any | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSection, setActiveSection] = useState<'pods' | 'conditions' | 'revisions'>('pods');

	useEffect(() => {
		if (!namespace || !deploymentName) return;

		setLoading(true);
		setError(null);

		AppAPI.GetDeploymentDetail(namespace, deploymentName)
			.then(data => {
				setDetail(data);
				setLoading(false);
			})
			.catch(err => {
				setError(err.message || 'Failed to fetch deployment details');
				setLoading(false);
			});
	}, [namespace, deploymentName]);

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	const formatDate = (dateStr?: string) => {
		if (!dateStr || dateStr === '-') return '-';
		try {
			const date = new Date(dateStr);
			return formatTimestampDMYHMS(date);
		} catch {
			return dateStr;
		}
	};

	return (
		<div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
			{/* Section tabs */}
			<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
				{(['pods', 'conditions', 'revisions'] as const).map(section => (
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
							textTransform: 'capitalize',
							fontSize: 13
						}}
					>
						{section}
						{section === 'pods' && detail?.pods && ` (${detail.pods.length})`}
						{section === 'revisions' && detail?.revisions && ` (${detail.revisions.length})`}
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
									<th>Name</th>
									<th>Status</th>
									<th>Ready</th>
									<th>Restarts</th>
									<th>Age</th>
									<th>Node</th>
								</tr>
							</thead>
							<tbody>
								{detail.pods.map((pod: any, idx: number) => (
									<tr key={pod.name || idx}>
										<td>{pod.name}</td>
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

			{/* Conditions section */}
			{activeSection === 'conditions' && (
				<>
					{!detail?.conditions || detail.conditions.length === 0 ? (
						<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No conditions.</div>
					) : (
						<table className="panel-table">
							<thead>
								<tr>
									<th>Type</th>
									<th>Status</th>
									<th>Last Transition</th>
									<th>Reason</th>
									<th>Message</th>
								</tr>
							</thead>
							<tbody>
								{detail.conditions.map((cond: any, idx: number) => (
									<tr key={idx}>
										<td>{cond.type}</td>
										<td>
											<span style={{
												color: cond.status === 'True' ? '#2ea44f' : '#f85149',
												fontWeight: 500
											}}>
												{cond.status}
											</span>
										</td>
										<td className="text-muted">{formatDate(cond.lastTransition)}</td>
										<td className="text-muted">{cond.reason || '-'}</td>
										<td className="text-muted" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cond.message || '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</>
			)}

			{/* Revisions section (Rollout History) */}
			{activeSection === 'revisions' && (
				<>
					{!detail?.revisions || detail.revisions.length === 0 ? (
						<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No revisions found.</div>
					) : (
						<table className="panel-table">
							<thead>
								<tr>
									<th>Revision</th>
									<th>ReplicaSet</th>
									<th>Image</th>
									<th>Created</th>
									<th style={{ textAlign: 'center' }}>Replicas</th>
									<th style={{ textAlign: 'center' }}>Current</th>
								</tr>
							</thead>
							<tbody>
								{detail.revisions.map((rev: any, idx: number) => (
									<tr key={idx} style={{ backgroundColor: rev.isCurrent ? '#23863610' : 'transparent' }}>
										<td style={{ fontWeight: rev.isCurrent ? 600 : 400 }}>
											#{rev.revision}
										</td>
										<td className="text-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{rev.replicaSet}</td>
										<td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rev.image}</td>
										<td className="text-muted">{formatDate(rev.createdAt)}</td>
										<td style={{ textAlign: 'center' }}>{rev.replicas}</td>
										<td style={{ textAlign: 'center' }}>
											{rev.isCurrent && (
												<span style={{
													padding: '2px 8px',
													backgroundColor: '#238636',
													color: '#fff',
													borderRadius: 10,
													fontSize: 11
												}}>
													Active
												</span>
											)}
										</td>
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

