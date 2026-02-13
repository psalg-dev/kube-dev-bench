import { useEffect, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import { EventsOff, EventsOn } from '../../../../wailsjs/runtime';
import AggregateLogsTab from '../../../components/AggregateLogsTab';
import ResourceActions from '../../../components/ResourceActions';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import ResourcePodsTab from '../../../components/ResourcePodsTab';
import type { HolmesContextProgressEvent, HolmesResponse } from '../../../holmes/holmesApi';
import { AnalyzeStatefulSetStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import YamlTab from '../../../layout/bottompanel/YamlTab';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { showError, showSuccess } from '../../../notification';
import QuickInfoSection from '../../../QuickInfoSection';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import StatefulSetPVCsTab from './StatefulSetPVCsTab';

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'namespace', label: 'Namespace' },
	{ key: 'replicas', label: 'Replicas' },
	{ key: 'ready', label: 'Ready' },
	{ key: 'age', label: 'Age' },
	{ key: 'image', label: 'Image' },
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary', countable: false },
	{ key: 'pods', label: 'Pods', countKey: 'pods' },
	{ key: 'pvcs', label: 'PVCs', countKey: 'pvcs' },
	{ key: 'logs', label: 'Logs', countable: false },
	{ key: 'events', label: 'Events', countKey: 'events' },
	{ key: 'yaml', label: 'YAML', countable: false },
	{ key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
	{ key: 'holmes', label: 'Holmes', countable: false },
];

type StatefulSetRow = {
	name: string;
	namespace: string;
	replicas: number;
	ready: number;
	age: string;
	image: string;
	labels: Record<string, string>;
};

type HolmesState = {
	loading: boolean;
	response: HolmesResponse | null;
	error: string | null;
	key: string | null;
	streamId: string | null;
	streamingText: string;
	reasoningText: string;
	queryTimestamp: string | null;
	contextSteps: HolmesContextStep[];
	toolEvents: HolmesToolEvent[];
};

type StatefulSetInfoRaw = app.StatefulSetInfo & {
	Name?: string;
	Namespace?: string;
	Replicas?: number;
	Ready?: number;
	Age?: string;
	Image?: string;
	Labels?: Record<string, string>;
	metadata?: { labels?: Record<string, string> };
};

const normalizeLabels = (labels?: Record<string, string> | null) => {
	if (!labels) return {};
	return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
		acc[key] = String(value ?? '');
		return acc;
	}, {});
};

const normalizeStatefulSet = (raw: StatefulSetInfoRaw): StatefulSetRow => ({
	name: raw.name ?? raw.Name ?? '',
	namespace: raw.namespace ?? raw.Namespace ?? '',
	replicas: raw.replicas ?? raw.Replicas ?? 0,
	ready: raw.ready ?? raw.Ready ?? 0,
	age: raw.age ?? raw.Age ?? '-',
	image: raw.image ?? raw.Image ?? '',
	labels: normalizeLabels(raw.labels ?? raw.Labels ?? raw.metadata?.labels),
});

function renderPanelContent(
	row: StatefulSetRow,
	tab: string,
	holmesState: HolmesState,
	onAnalyze: (_row: StatefulSetRow) => void,
	onCancel: () => void
) {
	if (tab === 'summary') {
		const quickInfoFields = [
			{
				key: 'replicas',
				label: 'Replicas',
				layout: 'flex' as const,
				rightField: {
					key: 'age',
					label: 'Age',
					type: 'age' as const,
					getValue: (data: { created?: string; age?: string }) => data.created || data.age,
				}
			},
			{ key: 'namespace', label: 'Namespace' },
			{ key: 'ready', label: 'Ready' },
			{ key: 'image', label: 'Image', type: 'break-word' as const },
			{ key: 'name', label: 'StatefulSet name', type: 'break-word' as const }
		];

		return (
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row.name}
					labels={row.labels}
					actions={(
						<ResourceActions
							resourceType="statefulset"
							name={row.name}
							namespace={row.namespace}
							replicaCount={row.replicas}
							onRestart={async () => {
								if (AppAPI.RestartStatefulSet) {
									await AppAPI.RestartStatefulSet(row.namespace, row.name);
									return;
								}
								throw new Error('RestartStatefulSet API unavailable; rebuild bindings');
							}}
							onDelete={async () => {
								await AppAPI.DeleteResource('statefulset', row.namespace, row.name);
							}}
						/>
					)}
				/>
				<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
					<QuickInfoSection
						resourceName={row.name}
						data={row}
						loading={false}
						error={null}
						fields={quickInfoFields}
					/>
					{/* Logs + Event History at a glance */}
					<div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
						<div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
							<AggregateLogsTab
								title="Logs"
								reloadKey={`${row.namespace}/${row.name}`}
								loadLogs={() => AppAPI.GetStatefulSetLogs(row.namespace, row.name)}
							/>
						</div>
						<div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
							<ResourceEventsTab
								namespace={row.namespace}
								kind="StatefulSet"
								name={row.name}
								limit={20}
							/>
						</div>
					</div>
				</div>
			</div>
		);
	}
	if (tab === 'pods') {
		return (
			<ResourcePodsTab
				namespace={row.namespace}
				resourceKind="StatefulSet"
				resourceName={row.name}
			/>
		);
	}
	if (tab === 'pvcs') {
		return (
			<StatefulSetPVCsTab
				namespace={row.namespace}
				statefulSetName={row.name}
			/>
		);
	}
	if (tab === 'logs') {
		return (
			<AggregateLogsTab
				title="StatefulSet Logs"
				reloadKey={`${row.namespace}/${row.name}`}
				loadLogs={() => AppAPI.GetStatefulSetLogs(row.namespace, row.name)}
			/>
		);
	}
	if (tab === 'events') {
		return (
			<ResourceEventsTab
				namespace={row.namespace}
				kind="StatefulSet"
				name={row.name}
			/>
		);
	}
	if (tab === 'yaml') {
		const yamlContent = `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${row.name}
  namespace: ${row.namespace}
spec:
  replicas: ${row.replicas}
  serviceName: ${row.name}
  selector:
    matchLabels:
      app: ${row.name}
  template:
    metadata:
      labels:
        app: ${row.name}
    spec:
      containers:
      - name: ${row.name}
        image: ${row.image}`;

		return <YamlTab content={yamlContent} />;
	}
	if (tab === 'relationships') {
		return <ResourceGraphTab namespace={row.namespace} kind="StatefulSet" name={row.name} />;
	}
	if (tab === 'holmes') {
		const key = `${row.namespace}/${row.name}`;
		return (
				<HolmesBottomPanel
				kind="StatefulSet"
				namespace={row.namespace}
				name={row.name}
				onAnalyze={() => onAnalyze(row)}
					onCancel={holmesState.key === key && holmesState.streamId ? onCancel : undefined}
				response={holmesState.key === key ? holmesState.response : null}
				loading={holmesState.key === key && holmesState.loading}
				error={holmesState.key === key ? holmesState.error : null}
				queryTimestamp={holmesState.key === key ? holmesState.queryTimestamp : null}
				streamingText={holmesState.key === key ? holmesState.streamingText : ''}
				reasoningText={holmesState.key === key ? holmesState.reasoningText : ''}
				toolEvents={holmesState.key === key ? holmesState.toolEvents : []}
				contextSteps={holmesState.key === key ? holmesState.contextSteps : []}
			/>
		);
	}
	return null;
}
function panelHeader(row: StatefulSetRow) {
	return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

type StatefulSetsOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
};

export default function StatefulSetsOverviewTable({ namespaces, namespace }: StatefulSetsOverviewTableProps) {
	const [items, setItems] = useState<StatefulSetRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [holmesState, setHolmesState] = useState<HolmesState>({
		loading: false,
		response: null,
		error: null,
		key: null,
		streamId: null,
		streamingText: '',
		reasoningText: '',
		queryTimestamp: null,
		contextSteps: [],
		toolEvents: [],
	});
	const holmesStateRef = useRef<HolmesState>(holmesState);
	useEffect(() => {
		holmesStateRef.current = holmesState;
	}, [holmesState]);

	// Subscribe to Holmes chat stream events
	useEffect(() => {
		const unsubscribe = onHolmesChatStream((payload) => {
			if (!payload) return;
			const current = holmesStateRef.current;
			const { streamId } = current;
			if (payload.stream_id && streamId && payload.stream_id !== streamId) {
				return;
			}
			if (payload.error) {
				if (payload.error === 'context canceled' || payload.error === 'context cancelled') {
					setHolmesState((prev) => ({ ...prev, loading: false }));
					return;
				}
				setHolmesState((prev) => ({ ...prev, loading: false, error: String(payload.error) }));
				return;
			}

			const eventType = payload.event;
			if (!payload.data) {
				return;
			}

			let data: Record<string, unknown> | null;
			try {
				data = JSON.parse(payload.data);
			} catch {
				data = null;
			}

			if (eventType === 'ai_message' && data) {
				let handled = false;
				const reasoning = typeof data.reasoning === 'string' ? data.reasoning : '';
				if (reasoning) {
					setHolmesState((prev) => ({
						...prev,
						reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + reasoning,
					}));
					handled = true;
				}
				const content = typeof data.content === 'string' ? data.content : '';
				if (content) {
					setHolmesState((prev) => {
						const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + content;
						return { ...prev, streamingText: nextText, response: { response: nextText } };
					});
					handled = true;
				}
				if (handled) return;
			}

			if (eventType === 'start_tool_calling' && data && data.id !== undefined) {
				const id = String(data.id);
				const name = typeof data.tool_name === 'string' ? data.tool_name : 'tool';
				const description = typeof data.description === 'string' ? data.description : undefined;
				setHolmesState((prev) => ({
					...prev,
					toolEvents: [...(prev.toolEvents || []), {
						id,
						name,
						status: 'running',
						description,
					}],
				}));
				return;
			}

			if (eventType === 'tool_calling_result' && data && data.tool_call_id !== undefined) {
				const toolId = String(data.tool_call_id);
				const result = data.result as { status?: unknown } | undefined;
				const status = typeof result?.status === 'string'
					? result.status
					: typeof data.status === 'string'
						? data.status
						: 'done';
				const description = typeof data.description === 'string' ? data.description : undefined;
				setHolmesState((prev) => ({
					...prev,
					toolEvents: (prev.toolEvents || []).map((item) =>
						item.id === toolId
							? { ...item, status, description: description ?? item.description }
							: item
					),
				}));
				return;
			}

			if (eventType === 'ai_answer_end' && data && typeof data.analysis === 'string') {
				const analysisText = data.analysis;
				setHolmesState((prev) => ({
					...prev,
					loading: false,
					response: { response: analysisText },
					streamingText: analysisText,
				}));
				return;
			}

			if (eventType === 'stream_end') {
				setHolmesState((prev) => {
					if (prev.streamingText) {
						return { ...prev, loading: false, response: { response: prev.streamingText } };
					}
					return { ...prev, loading: false };
				});
			}
		});
		return () => {
			try { unsubscribe?.(); } catch { /* ignore */ }
		};
	}, []);

	useEffect(() => {
		const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressEvent | null) => {
			if (!event?.key) return;
			setHolmesState((prev) => {
				if (prev.key !== event.key) return prev;
				const id = event.step || 'step';
				const nextSteps = Array.isArray(prev.contextSteps) ? [...prev.contextSteps] : [];
				const idx = nextSteps.findIndex((item) => item.id === id);
				const entry = {
					id,
					step: event.step,
					status: event.status || 'running',
					detail: event.detail || '',
				};
				if (idx >= 0) {
					nextSteps[idx] = { ...nextSteps[idx], ...entry };
				} else {
					nextSteps.push(entry);
				}
				return { ...prev, contextSteps: nextSteps };
			});
		});
		return () => {
			try { unsubscribe?.(); } catch { /* ignore */ }
		};
	}, []);

	// Aggregate fetch by namespaces
	useEffect(() => {
		const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
		if (nsArr.length === 0) return;
		let cancelled = false;
		const run = async () => {
			try {
				setLoading(true);
				const lists = await Promise.all(nsArr.map(ns => AppAPI.GetStatefulSets(ns).catch(() => [])));
				if (cancelled) return;
				const flat = lists.flat().map((x) => normalizeStatefulSet(x as StatefulSetInfoRaw));
				setItems(flat);
			} catch {
				if (!cancelled) setItems([]);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		run();
		return () => { cancelled = true; };
	}, [namespaces, namespace]);

	// Live updates (already aggregated by backend polling)
	useEffect(() => {
		const onUpdate = (list: unknown) => {
			try {
				const arr = Array.isArray(list) ? list : [];
				const norm = arr.map((x) => normalizeStatefulSet(x as StatefulSetInfoRaw));
				setItems(norm);
			} catch {
				setItems([]);
			} finally {
				setLoading(false);
			}
		};
		EventsOn('statefulsets:update', onUpdate);
		return () => { try { EventsOff('statefulsets:update'); } catch { /* ignore */ } };
	}, []);
	const analyzeStatefulSet = async (row: StatefulSetRow) => {
		const key = `${row.namespace}/${row.name}`;
		const streamId = `statefulset-${Date.now()}`;
		setHolmesState({
			loading: true,
			response: null,
			error: null,
			key,
			streamId,
			streamingText: '',
			reasoningText: '',
			queryTimestamp: new Date().toISOString(),
			contextSteps: [],
			toolEvents: [],
		});
		try {
			await AnalyzeStatefulSetStream(row.namespace, row.name, streamId);
			// The response comes via stream events, not from the return value
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setHolmesState((prev) => ({ ...prev, loading: false, response: null, error: message, key }));
			showError(`Holmes analysis failed: ${message}`);
		}
	};

	const cancelHolmesAnalysis = async () => {
		const currentStreamId = holmesState.streamId;
		if (!currentStreamId) return;
		setHolmesState((prev) => ({ ...prev, loading: false, streamId: null }));
		try {
			await CancelHolmesStream(currentStreamId);
		} catch (err) {
			console.error('Failed to cancel Holmes stream:', err);
		}
	};

	const getRowActions = (row: StatefulSetRow, api: { openDetails?: (_tabKey?: string) => void }) => {
		const key = `${row.namespace}/${row.name}`;
		const isAnalyzing = holmesState.loading && holmesState.key === key;
		return [
			{
				label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
				icon: '🧠',
				disabled: isAnalyzing,
				onClick: () => {
					analyzeStatefulSet(row);
					api?.openDetails?.('holmes');
				},
			},
			{
				label: 'Restart',
				icon: '🔄',
				onClick: async () => {
					try {
						if (AppAPI.RestartStatefulSet) {
							await AppAPI.RestartStatefulSet(row.namespace, row.name);
							showSuccess(`StatefulSet '${row.name}' restarted`);
						} else {
							showError('RestartStatefulSet API unavailable');
						}
					} catch (err) {
						showError(`Failed to restart StatefulSet '${row.name}': ${err instanceof Error ? err.message : err}`);
					}
				},
			},
			{
				label: 'Delete',
				icon: '🗑️',
				danger: true,
				onClick: async () => {
					try {
						await AppAPI.DeleteResource('statefulset', row.namespace, row.name);
						showSuccess(`StatefulSet '${row.name}' deleted`);
					} catch (err) {
						showError(`Failed to delete StatefulSet '${row.name}': ${err instanceof Error ? err.message : err}`);
					}
				},
			},
		];
	};

	return (
		<OverviewTableWithPanel
			columns={columns}
			data={items}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeStatefulSet, cancelHolmesAnalysis)}
			panelHeader={panelHeader}
			title="Stateful Sets"
			resourceKind="StatefulSet"
			namespace={namespace}
			loading={loading}
			getRowActions={getRowActions}
		/>
	);
}

export { StatefulSetsOverviewTable };

