import { useEffect, useState } from 'react';
import { GetSwarmNetworkContainers } from '../../swarmApi';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import type { docker } from '../../../../wailsjs/go/models';

/**
 * Displays connected containers (tasks) in the Network Inspect tab.
 */
type NetworkConnectedContainersSectionProps = {
	networkId?: string;
};

export default function NetworkConnectedContainersSection({ networkId }: NetworkConnectedContainersSectionProps) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [tasks, setTasks] = useState<docker.SwarmTaskInfo[]>([]);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError('');

		const resolvedId = networkId;
		if (!resolvedId) {
			setTasks([]);
			setLoading(false);
			return () => {
				active = false;
			};
		}

		(async () => {
			try {
				const data = await GetSwarmNetworkContainers(resolvedId);
				if (!active) return;
				setTasks(Array.isArray(data) ? (data as docker.SwarmTaskInfo[]) : []);
			} catch (e) {
				if (!active) return;
				setTasks([]);
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (active) setLoading(false);
			}
		})();

		return () => {
			active = false;
		};
	}, [networkId]);

	const emptyMsg = getEmptyTabMessage('swarm-containers');

	return (
		<div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
			<div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
				Containers (Tasks)
			</div>
			<div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, marginBottom: 10 }}>
				Swarm attaches tasks (containers) to networks.
			</div>

			{loading ? (
				<div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
			) : null}

			{error ? (
				<div style={{ color: '#f85149' }}>Failed to load containers: {error}</div>
			) : null}

			{!loading && !error ? (
				tasks.length === 0 ? (
					<EmptyTabContent
						icon={emptyMsg.icon}
						title={emptyMsg.title}
						description={emptyMsg.description}
						tip={emptyMsg.tip}
					/>
				) : (
					<div style={{ display: 'grid', gap: 6 }}>
						{tasks
							.slice()
							.sort((a, b) => String(a?.serviceName || a?.serviceId || '').localeCompare(String(b?.serviceName || b?.serviceId || '')))
							.map((task) => {
								const handleTaskClick = () => {
									if (task.id) {
										navigateToResource({ resource: 'SwarmTask', name: task.id });
									}
								};

								const label = task.serviceName || task.serviceId || task.id;

								return (
									<div
										key={task.id || label}
										onClick={handleTaskClick}
										role="button"
										tabIndex={0}
										onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTaskClick(); }}
										title={task.id ? `Open task: ${task.id}` : undefined}
										style={{
											padding: '8px 10px',
											border: '1px solid var(--gh-border, #30363d)',
											background: 'var(--gh-input-bg, #0d1117)',
											color: 'var(--gh-link, #58a6ff)',
											fontFamily: 'monospace',
											fontSize: 12,
											wordBreak: 'break-word',
											cursor: task.id ? 'pointer' : 'default',
											transition: 'background-color 0.15s ease, color 0.15s ease',
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor = 'var(--gh-hover-bg, rgba(177, 186, 196, 0.12))';
											e.currentTarget.style.textDecoration = 'underline';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = 'var(--gh-input-bg, #0d1117)';
											e.currentTarget.style.textDecoration = 'none';
										}}
									>
										<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
											<span>{label || '-'}</span>
											{task.slot ? (
												<span style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>#{task.slot}</span>
											) : null}
										</div>
										{task.id ? (
											<div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 11, marginTop: 4 }}>
												Task ID: {task.id}
											</div>
										) : null}
									</div>
								);
							})}
					</div>
				)
			) : null}
		</div>
	);
}

