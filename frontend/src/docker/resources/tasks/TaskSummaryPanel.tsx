import { useEffect, useState } from 'react';
import type { docker } from '../../../../wailsjs/go/models';
import StatusBadge from '../../../components/StatusBadge';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../../QuickInfoSection';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import { GetSwarmTaskHealthLogs } from '../../swarmApi';
import HealthStatusBadge from './HealthStatusBadge';

type SwarmTaskRow = docker.SwarmTaskInfo;
type HealthLogEntry = docker.SwarmHealthLogEntry;

type HealthCheckSectionProps = { row?: SwarmTaskRow | null };

function HealthCheckSection({ row }: HealthCheckSectionProps) {
	const [logs, setLogs] = useState<HealthLogEntry[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let active = true;
		const load = async () => {
			if (!row?.id) return;
			setLoading(true);
			try {
				const data = await GetSwarmTaskHealthLogs(row.id);
				if (!active) return;
				setLogs(Array.isArray(data) ? (data as HealthLogEntry[]) : []);
			} catch {
				if (!active) return;
				setLogs([]);
			} finally {
				// eslint-disable-next-line no-unsafe-finally
				if (!active) return;
				setLoading(false);
			}
		};
		if (row?.containerId) {
			load();
		} else {
			setLogs([]);
		}
		return () => {
			active = false;
		};
	}, [row?.id, row?.containerId]);

	const hc = row?.healthCheck;
	const hasHc = !!hc && Array.isArray(hc.test) && hc.test.length > 0;

	return (
		<div style={{ padding: '12px 16px 0 16px' }}>
			<div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>Health Check</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
				<HealthStatusBadge status={row?.healthStatus} />
				<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>{hasHc ? 'Configured' : 'Not configured'}</div>
			</div>

			{hasHc ? (
				<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
					<div><div style={{ marginBottom: 2 }}>Test</div><div style={{ color: 'var(--gh-text, #c9d1d9)', wordBreak: 'break-word' }}>{hc.test.join(' ')}</div></div>
					<div><div style={{ marginBottom: 2 }}>Retries</div><div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.retries ?? '-'}</div></div>
					<div><div style={{ marginBottom: 2 }}>Interval</div><div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.interval || '-'}</div></div>
					<div><div style={{ marginBottom: 2 }}>Timeout</div><div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.timeout || '-'}</div></div>
					<div><div style={{ marginBottom: 2 }}>Start Period</div><div style={{ color: 'var(--gh-text, #c9d1d9)' }}>{hc.startPeriod || '-'}</div></div>
				</div>
			) : (
				<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No health check configured.</div>
			)}

			<div style={{ marginTop: 12 }}>
				<div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>Recent Results</div>
				{loading ? (
					<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
				) : logs.length === 0 ? (
					<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No health check results.</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						{logs.slice(-6).map((l, idx) => (
							<div key={idx} style={{ border: '1px solid var(--gh-border, #30363d)', padding: '6px 8px', fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
									<div>Exit {l.exitCode}</div>
									<div>{l.end ? formatTimestampDMYHMS(l.end) : '-'}</div>
								</div>
								{l.output ? <div style={{ marginTop: 4, color: 'var(--gh-text, #c9d1d9)', whiteSpace: 'pre-wrap' }}>{l.output}</div> : null}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

type TaskInfoPanelProps = { row?: SwarmTaskRow | null };

function TaskInfoPanel({ row }: TaskInfoPanelProps) {
	const [logs, setLogs] = useState<HealthLogEntry[]>([]);
	const [loadingLogs, setLoadingLogs] = useState(false);
	const STATUS_LABELS = new Set(['Current State', 'Desired State', 'Health Status']);

	useEffect(() => {
		let active = true;
		const load = async () => {
			if (!row?.id) return;
			setLoadingLogs(true);
			try {
				const data = await GetSwarmTaskHealthLogs(row.id);
				if (!active) return;
				setLogs(Array.isArray(data) ? (data as HealthLogEntry[]) : []);
			} catch {
				if (!active) return;
				setLogs([]);
			} finally {
				// eslint-disable-next-line no-unsafe-finally
				if (!active) return;
				setLoadingLogs(false);
			}
		};
		if (row?.containerId) {
			load();
		} else {
			setLogs([]);
		}
		return () => {
			active = false;
		};
	}, [row?.id, row?.containerId]);

	const hc = row?.healthCheck;
	const hasHc = !!hc && Array.isArray(hc.test) && hc.test.length > 0;
	const hasTimeline = row?.createdAt || row?.updatedAt || row?.state || row?.desiredState;

	if (!hasTimeline && !hasHc) return null;

	const infoItems: Array<{ label: string; value: string; breakWord?: boolean }> = [];
	if (row?.createdAt) infoItems.push({ label: 'Created', value: formatTimestampDMYHMS(row.createdAt) });
	if (row?.updatedAt) infoItems.push({ label: 'Updated', value: formatTimestampDMYHMS(row.updatedAt) });
	if (row?.state) infoItems.push({ label: 'Current State', value: row.state });
	if (row?.desiredState) infoItems.push({ label: 'Desired State', value: row.desiredState });
	infoItems.push({ label: 'Health Status', value: row?.healthStatus || 'none' });
	infoItems.push({ label: 'Health Config', value: hasHc ? 'Configured' : 'Not configured' });
	if (hasHc) {
		infoItems.push({ label: 'Health Test', value: hc.test.join(' '), breakWord: true });
		if (hc.retries != null) infoItems.push({ label: 'Retries', value: String(hc.retries) });
		if (hc.interval) infoItems.push({ label: 'Interval', value: hc.interval });
		if (hc.timeout) infoItems.push({ label: 'Timeout', value: hc.timeout });
		if (hc.startPeriod) infoItems.push({ label: 'Start Period', value: hc.startPeriod });
	}
	if (infoItems.length === 0) return null;

	return (
		<div style={{ width: 320, minWidth: 260, borderLeft: '1px solid var(--gh-border, #30363d)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
			<div style={{ padding: '12px 16px' }}>
				<div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: 'var(--gh-text, #c9d1d9)' }}>Task Details</div>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
					{infoItems.map((item) => {
						const isStatus = STATUS_LABELS.has(item.label);
						return (
							<div key={item.label} style={{ display: 'grid', gap: 2 }}>
								<div style={{ fontSize: 11, color: 'var(--gh-text-secondary, #8b949e)' }}>{item.label}</div>
								<div style={{ fontSize: 12, color: 'var(--gh-text, #c9d1d9)', wordBreak: item.breakWord ? 'break-word' : 'normal', display: 'flex', alignItems: 'center', gap: 8 }}>
									{isStatus ? <StatusBadge status={item.value} size="small" /> : item.value}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{row?.containerId ? (
				<div style={{ padding: '0 16px 16px 16px' }}>
					<div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--gh-text, #c9d1d9)' }}>Health Check Results</div>
					{loadingLogs ? (
						<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
					) : logs.length === 0 ? (
						<div style={{ fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>No health check results.</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
							{logs.slice(-8).map((l, idx) => (
								<div key={idx} style={{ border: '1px solid var(--gh-border, #30363d)', padding: '6px 8px', fontSize: 12, color: 'var(--gh-text-secondary, #8b949e)' }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
										<div>Exit {l.exitCode}</div>
										<div>{l.end ? formatTimestampDMYHMS(l.end) : '-'}</div>
									</div>
									{l.output ? <div style={{ marginTop: 4, color: 'var(--gh-text, #c9d1d9)', whiteSpace: 'pre-wrap' }}>{l.output}</div> : null}
								</div>
							))}
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}

type TaskSummaryPanelProps = { row?: SwarmTaskRow | null };

function TaskSummaryPanel({ row }: TaskSummaryPanelProps) {
	const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date' }> = [
		{ key: 'id', label: 'Task ID', type: 'break-word' },
		{ key: 'serviceName', label: 'Service' },
		{ key: 'nodeName', label: 'Node' },
		{ key: 'slot', label: 'Slot' },
		{ key: 'state', label: 'State' },
		{ key: 'desiredState', label: 'Desired' },
		{ key: 'containerId', label: 'Container', type: 'break-word' },
		{ key: 'createdAt', label: 'Created', type: 'date' },
		{ key: 'updatedAt', label: 'Updated', type: 'date' },
	];

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader name={row?.serviceName || row?.id} />
			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row?.id}
					data={row ?? undefined}
					loading={false}
					error={null}
					fields={quickInfoFields}
				/>
				<TaskInfoPanel row={row} />
			</div>
			<HealthCheckSection row={row} />
		</div>
	);
}

export default TaskSummaryPanel;
export { TaskSummaryPanel };
