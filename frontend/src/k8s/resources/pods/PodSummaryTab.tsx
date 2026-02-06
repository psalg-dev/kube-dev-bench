import { useEffect, useState } from 'react';
import { GetPodSummary, GetPodEvents, GetPodEventsLegacy } from '../../../../wailsjs/go/main/App';
import LogViewerTab from '../../../layout/bottompanel/LogViewerTab';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import * as AppAPI from '../../../../wailsjs/go/main/App.js';
import { formatTimestampDMYHMS } from '../../../utils/dateUtils';
import StatusBadge from '../../../components/StatusBadge';

type PodSummaryTabProps = {
	podName: string;
	namespace?: string;
};

export default function PodSummaryTab({ podName, namespace }: PodSummaryTabProps) {
	const [data, setData] = useState<any | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Events panel state
	const [events, setEvents] = useState<any[]>([]);
	const [eventsLoading, setEventsLoading] = useState(false);
	const [eventsError, setEventsError] = useState<string | null>(null);

	const load = async () => {
		if (!podName) return;
		setLoading(true);
		setError(null);
		try {
			const res = await GetPodSummary(podName);
			setData(res || null);
		} catch (e) {
			setError(String(e));
		} finally {
			setLoading(false);
		}
	};

	// Load last 5 events for the current pod (sorted by lastTimestamp desc)
	const loadEvents = async (ns?: string) => {
		if (!podName) return;
		setEventsLoading(true);
		setEventsError(null);
		try {
			let res: any[] = [];
			if (ns !== undefined) {
				try {
					res = await GetPodEvents(ns || '', podName);
				} catch (e) {
					// fallback to legacy if available
					try { res = await GetPodEventsLegacy(podName); } catch { throw e; }
				}
			} else {
				// if namespace unknown yet, try legacy
				res = await GetPodEventsLegacy(podName);
			}
			const arr = Array.isArray(res) ? res : [];
			arr.sort((a, b) => {
				const ta = a?.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
				const tb = b?.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
				return tb - ta; // desc
			});
			setEvents(arr.slice(0, 5));
		} catch (e) {
			setEventsError(String(e));
			// keep previous events on error to avoid flicker
		} finally {
			setEventsLoading(false);
		}
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { load(); }, [podName]);

	// Load events when podName or namespace changes (after summary loaded)
	useEffect(() => {
		const ns = (data && data.namespace) ? data.namespace : undefined;
		loadEvents(ns);
		const id = setInterval(() => loadEvents(ns), 5000);
		return () => clearInterval(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [podName, data && data.namespace]);

	// Removed log streaming side-effect: handled by <LogViewer /> directly.

	const renderLabels = (labels: Record<string, string>) => {
		if (!labels || Object.keys(labels).length === 0) return '-';
		const pairs = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`);
		return (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
				{pairs.map((p, i) => (
					<span key={i} style={{ background: 'rgba(56,139,253,0.12)', border: '1px solid #30363d', padding: '2px 6px', borderRadius: 0, color: '#c9d1d9' }}>{p}</span>
				))}
			</div>
		);
	};

	const formatDuration = (date?: string) => {
		if (!date) return '-';
		const d = new Date(date);
		if (isNaN(d.getTime())) return '-';
		const ms = Date.now() - d.getTime();
		if (ms < 0) return 'just now';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const days = Math.floor(h / 24);
		if (days > 0) return `${days}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	};

	// Helper for init container state badges
	const getInitContainerBadgeStatus = (state?: string, exitCode?: number) => {
		const s = String(state || '').toLowerCase();
		if (s === 'terminated') {
			if (exitCode === 0) return 'succeeded';
			return 'failed';
		}
		if (s === 'running') return 'running';
		if (s === 'waiting') return 'waiting';
		return s || 'unknown';
	};
	// Handler for restart (no UI side-effects; ResourceActions shows notifications)
	const handleRestart = async (name: string, ns?: string) => {
		if (typeof AppAPI.RestartPod !== 'function') throw new Error('RestartPod API unavailable');
		const resolvedNs = ns ?? namespace ?? data?.namespace ?? data?.Namespace ?? '';
		if (!resolvedNs) throw new Error('Namespace unavailable for restart');
		await AppAPI.RestartPod(resolvedNs, name);
		// refresh summary after restart
		await load();
	};
	// Handler for delete (two-step confirm handled by ResourceActions)
	const handleDelete = async (name: string, ns?: string) => {
		if (typeof AppAPI.DeletePod !== 'function') throw new Error('DeletePod API unavailable');
		const resolvedNs = ns ?? namespace ?? data?.namespace ?? data?.Namespace ?? '';
		if (!resolvedNs) throw new Error('Namespace unavailable for delete');
		await AppAPI.DeletePod(resolvedNs, name);
	};

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				_hideTitle
				name={podName}
				labels={data?.labels || data?.Labels || data?.metadata?.labels}
				actions={
					<ResourceActions
						resourceType="Pod"
						name={podName}
						namespace={data?.namespace || data?.Namespace || ''}
						onRestart={handleRestart}
						onDelete={handleDelete}
						disabled={!data}
					/>
				}
			/>
			{loading && <div style={{ padding: 12, color: 'var(--gh-text-muted, #8b949e)' }}>Loading…</div>}
			{error && <div style={{ padding: 12, color: '#f85149' }}>Error: {error}</div>}
			{!loading && !error && (
				<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
					{/* Left-side panel (Quick info) */}
					<div style={{ width: 320, borderRight: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-canvas, #0d1117)', display: 'flex', flexDirection: 'column', minWidth: 260, textAlign: 'left' }}>
						<div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600, textAlign: 'left' }}>Quick info</div>
						<div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 10, flex: 1, overflow: 'auto', textAlign: 'left' }}>
							{data ? (
								<>
									{/* Status (left) and Age (right) on one row */}
									<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
										<div>
											<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Status</div>
											<StatusBadge status={data.status || '-'} size="small" showDot={false} />
										</div>

										<div style={{ textAlign: 'right' }}>
											<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Age</div>
											<div style={{ whiteSpace: 'nowrap' }}>{formatDuration(data.created)}</div>
										</div>
									</div>

									{/* Namespace */}
									<div>
										<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Namespace</div>
										<div>{data.namespace || '-'}</div>
									</div>

									{/* Labels */}
									<div>
										<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Labels</div>
										{renderLabels(data.labels)}
									</div>

									{/* Ports */}
									<div>
										<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Ports</div>
										<div>
											{data.ports && data.ports.length > 0 ? (
												<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
													{data.ports.map((port: string, i: number) => (
														<span key={i} style={{ background: 'rgba(46,160,67,0.15)', border: '1px solid #30363d', padding: '2px 6px', borderRadius: 0, color: '#3fb950' }}>
															{port}
														</span>
													))}
												</div>
											) : (
												'-'
											)}
										</div>
									</div>

									{/* Pod name */}
									<div>
										<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Pod name</div>
										<div style={{ wordBreak: 'break-all' }}>{data.name || '-'}</div>
									</div>

									{/* Init Containers */}
									{data.initContainers && data.initContainers.length > 0 && (
										<div>
											<div style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)', marginBottom: 4 }}>Init Containers</div>
											<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
												{data.initContainers.map((ic: any, i: number) => {
													const badgeStatus = getInitContainerBadgeStatus(ic.state, ic.exitCode);
													return (
														<div
															key={i}
															style={{
																background: 'var(--gh-bg-subtle, #161b22)',
																border: '1px solid var(--gh-border, #30363d)',
																padding: 8,
															}}
														>
															<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
																<span style={{ fontWeight: 500, wordBreak: 'break-all' }}>{ic.name}</span>
																<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
																	<StatusBadge status={badgeStatus} size="small" showDot={false} />
																	{ic.stateReason && (
																		<span style={{ fontSize: 11, color: 'var(--gh-text-muted, #8b949e)' }}>
																			({ic.stateReason})
																		</span>
																	)}
																</div>
															</div>
															<div style={{ fontSize: 11, color: 'var(--gh-text-muted, #8b949e)', marginTop: 4, wordBreak: 'break-all' }}>
																{ic.image}
															</div>
															{ic.stateMessage && (
																<div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>
																	{ic.stateMessage}
																</div>
															)}
															{ic.restartCount > 0 && (
																<div style={{ fontSize: 11, color: '#d29922', marginTop: 4 }}>
																	Restarts: {ic.restartCount}
																</div>
															)}
															{ic.exitCode !== undefined && ic.exitCode !== null && (
																<div style={{ fontSize: 11, color: ic.exitCode === 0 ? '#3fb950' : '#f85149', marginTop: 4 }}>
																	Exit code: {ic.exitCode}
																</div>
															)}
														</div>
													);
												})}
											</div>
										</div>
									)}

									{/* Refresh */}
									<div style={{ marginTop: 8 }}>
										<button onClick={load} disabled={loading} style={{ padding: '6px 10px', background: 'rgba(56,139,253,0.15)', color: '#58a6ff', border: '1px solid #30363d', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
											{loading ? 'Refreshing…' : 'Refresh'}
										</button>
									</div>
								</>
							) : (
								<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No data.</div>
							)}
						</div>
					</div>

					{/* Middle panel: Logs (streaming, last 20 lines) */}
					<div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column' }}>
						<div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
							<span style={{ fontWeight: 600 }}>Logs</span>
						</div>
						<div style={{ flex: 1, minHeight: 0 }}>
							<LogViewerTab podName={podName} namespace={namespace} embedded={true} />
						</div>
					</div>

					{(() => {
						const hasEvents = Array.isArray(events) && events.length > 0;
						if (!hasEvents) return null;
						return (
							<div style={{ width: 360, minWidth: 280, borderLeft: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-canvas, #0d1117)', display: 'flex', flexDirection: 'column' }}>
								<div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
									<span style={{ fontWeight: 600 }}>Events</span>
									<span style={{ fontSize: 12, color: 'var(--gh-text-muted, #8b949e)' }}>{eventsLoading ? 'Updating…' : ''}</span>
								</div>
								<div className="scrollbar-hide-y" style={{ padding: 12, flex: 1, overflow: 'auto' }}>
									{(() => {
										if (hasEvents) {
											return (
												<ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
													{events.map((e, idx) => {
														const key = `${e.lastTimestamp ?? ''}|${e.type ?? ''}|${e.reason ?? ''}|${(e.message || '').slice(0, 24)}|${idx}`;
														return (
															<li key={key} style={{ borderBottom: '1px solid var(--gh-border, #30363d)', paddingBottom: 8 }}>
																<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
																	<span style={{ color: '#8b949e', fontSize: 12 }}>{e.type || '-'}</span>
																	<span style={{ color: '#8b949e', fontSize: 12 }}>{formatTimestampDMYHMS(e.lastTimestamp)}</span>
																</div>
																<div style={{ marginTop: 4, fontWeight: 600 }}>{e.reason || '-'}</div>
																<div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--gh-text, #c9d1d9)' }}>{e.message || '-'}</div>
																{typeof e.count === 'number' && <div style={{ marginTop: 4, color: '#8b949e', fontSize: 12 }}>Count: {e.count}</div>}
																{e.source && <div style={{ marginTop: 2, color: '#8b949e', fontSize: 12 }}>Source: {e.source}</div>}
															</li>
														);
													})}
												</ul>
											);
										}
										if (eventsLoading) return <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>Loading events…</div>;
										if (eventsError) return <div style={{ color: '#f85149' }}>Error: {eventsError}</div>;
										return <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No recent events.</div>;
									})()}
								</div>
							</div>
						);
					})()}
				</div>
			)}
		</div>
	);
}
