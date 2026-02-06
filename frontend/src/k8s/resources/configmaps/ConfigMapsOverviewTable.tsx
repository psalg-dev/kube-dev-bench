import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import ConfigMapYamlTab from './ConfigMapYamlTab';
import ConfigMapDataTab from './ConfigMapDataTab';
import ConfigMapConsumersTab from './ConfigMapConsumersTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeConfigMapStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import type { app } from '../../../../wailsjs/go/models';

type ConfigMapsOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
	onConfigMapCreate?: () => void;
};

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'namespace', label: 'Namespace' },
	{ key: 'keys', label: 'Keys' },
	{ key: 'size', label: 'Size' },
	{ key: 'age', label: 'Age' },
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary', countable: false },
	{ key: 'data', label: 'Data', countKey: 'data' },
	{ key: 'consumers', label: 'Consumers', countKey: 'consumers' },
	{ key: 'events', label: 'Events', countKey: 'events' },
	{ key: 'yaml', label: 'YAML', countable: false },
	{ key: 'holmes', label: 'Holmes', countable: false },
];

type ConfigMapRow = {
	name: string;
	namespace: string;
	keys: string | number;
	size: string | number;
	age: string;
	labels: Record<string, string>;
	created?: string;
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

type ConfigMapInfoRaw = app.ConfigMapInfo & {
	Name?: string;
	Namespace?: string;
	Keys?: string | number;
	Size?: string | number;
	Age?: string;
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

const normalizeConfigMap = (cm: ConfigMapInfoRaw): ConfigMapRow => ({
	name: cm.name ?? cm.Name ?? '',
	namespace: cm.namespace ?? cm.Namespace ?? '',
	keys: cm.keys ?? cm.Keys ?? '-',
	size: cm.size ?? cm.Size ?? '-',
	age: cm.age ?? cm.Age ?? '-',
	labels: normalizeLabels(cm.labels ?? cm.Labels ?? cm.metadata?.labels),
});

const normalizeConfigMaps = (arr: ConfigMapInfoRaw[] | null | undefined): ConfigMapRow[] =>
	(arr || []).filter(Boolean).map(normalizeConfigMap);

function renderPanelContent(
	row: ConfigMapRow,
	tab: string,
	holmesState: HolmesState,
	onAnalyze: (row: ConfigMapRow) => void,
	onCancel: () => void
) {
	if (tab === 'summary') {
		const quickInfoFields: QuickInfoField[] = [
			{
				key: 'keys',
				label: 'Keys',
				layout: 'flex',
				rightField: {
					key: 'age',
					label: 'Age',
					type: 'age',
					getValue: (data: Record<string, unknown>) => {
						const rowData = data as ConfigMapRow;
						return rowData.created || rowData.age;
					},
				},
			},
			{ key: 'namespace', label: 'Namespace' },
			{ key: 'size', label: 'Size' },
			{ key: 'name', label: 'ConfigMap name', type: 'break-word' },
		];

		return (
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row.name}
					labels={row.labels}
					actions={(
						<ResourceActions
							resourceType="configmap"
							name={row.name}
							namespace={row.namespace}
							onDelete={async (n, ns) => {
								const targetNamespace = ns || row.namespace;
								if (!n || !targetNamespace) return;
								await AppAPI.DeleteResource('configmap', targetNamespace, n);
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
					{/* Editable Data + Event History at a glance */}
					<div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
						<div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
							<ConfigMapDataTab namespace={row.namespace} configMapName={row.name} />
						</div>
						<div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
							<ResourceEventsTab namespace={row.namespace} resourceKind="ConfigMap" resourceName={row.name} limit={20} />
						</div>
					</div>
				</div>
			</div>
		);
	}
	if (tab === 'data') {
		return <ConfigMapDataTab namespace={row.namespace} configMapName={row.name} />;
	}
	if (tab === 'consumers') {
		return <ConfigMapConsumersTab namespace={row.namespace} configMapName={row.name} />;
	}
	if (tab === 'events') {
		return <ResourceEventsTab namespace={row.namespace} resourceKind="ConfigMap" resourceName={row.name} />;
	}
	if (tab === 'yaml') {
		return <ConfigMapYamlTab namespace={row.namespace} name={row.name} />;
	}
	if (tab === 'holmes') {
		const key = `${row.namespace}/${row.name}`;
		return (
			<HolmesBottomPanel
				kind="ConfigMap"
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


export default function ConfigMapsOverviewTable({ namespaces = [], namespace, onConfigMapCreate }: ConfigMapsOverviewTableProps) {
	const [data, setData] = useState<ConfigMapRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
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

	// Timers and guards as refs so we can restart fast polling on new creates
	const inFlightRef = useRef(false);
	const fastTimerRef = useRef<number | null>(null);
	const slowTimerRef = useRef<number | null>(null);

	const clearTimers = () => {
		if (fastTimerRef.current) {
			clearInterval(fastTimerRef.current);
			fastTimerRef.current = null;
		}
		if (slowTimerRef.current) {
			clearInterval(slowTimerRef.current);
			slowTimerRef.current = null;
		}
	};

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
				setHolmesState((prev) => ({
					...prev,
					loading: false,
					error: payload.error ? String(payload.error) : null,
				}));
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
				const description = typeof data.description === 'string' ? data.description : '';
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

			if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
				const result = data.result as Record<string, unknown> | undefined;
				const status = String(result?.status ?? data.status ?? 'done');
				const description = typeof data.description === 'string' ? data.description : undefined;
				setHolmesState((prev) => ({
					...prev,
					toolEvents: (prev.toolEvents || []).map((item) =>
						item.id === data.tool_call_id
							? { ...item, status, description: description ?? item.description }
							: item
					),
				}));
				return;
			}

			if (eventType === 'ai_answer_end' && data && data.analysis) {
				const analysis = typeof data.analysis === 'string' ? data.analysis : '';
				setHolmesState((prev) => ({
					...prev,
					loading: false,
					response: { response: analysis },
					streamingText: analysis,
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
			try { unsubscribe?.(); } catch (_) {}
		};
	}, []);

	useEffect(() => {
		const unsubscribe = onHolmesContextProgress((event) => {
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
			try { unsubscribe?.(); } catch (_) {}
		};
	}, []);

	// Fetch configmaps for all selected namespaces
	const fetchConfigMaps = async () => {
		const nsList = namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
		if (nsList.length === 0) return;
		setLoading(true);
		setError(null);
		try {
			let allConfigMaps: ConfigMapRow[] = [];
			for (const ns of nsList) {
				const configmaps = await AppAPI.GetConfigMaps(ns).catch(() => [] as app.ConfigMapInfo[]);
				allConfigMaps = allConfigMaps.concat(normalizeConfigMaps(configmaps || []));
			}
			setData(allConfigMaps);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message || 'Failed to fetch configmaps');
			setData([]);
		} finally {
			setLoading(false);
		}
	};

	// Fast polling for all selected namespaces
	const periodicFetch = async () => {
		if (inFlightRef.current) return;
		inFlightRef.current = true;
		try {
			await fetchConfigMaps();
		} catch (_) {
			// ignore periodic errors
		} finally {
			inFlightRef.current = false;
		}
	};

	const startFastPollingWindow = () => {
		clearTimers();
		let elapsed = 0;
			fastTimerRef.current = window.setInterval(async () => {
			await periodicFetch();
			elapsed += 1;
			if (elapsed >= 60) {
				if (fastTimerRef.current) {
					clearInterval(fastTimerRef.current);
					fastTimerRef.current = null;
				}
					slowTimerRef.current = window.setInterval(() => periodicFetch(), 60000);
			}
		}, 1000);
	};

	useEffect(() => {
		fetchConfigMaps();
		startFastPollingWindow();
		return () => clearTimers();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [JSON.stringify(namespaces), namespace]);

	// Generic resource-updated fallback
	useEffect(() => {
		EventsOn('resource-updated', (eventData) => {
			if (eventData?.resource === 'configmap' && (namespaces.includes(eventData?.namespace) || eventData?.namespace === namespace)) {
				fetchConfigMaps();
				startFastPollingWindow();
			}
		});
		return () => {
			EventsOff('resource-updated');
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [JSON.stringify(namespaces), namespace]);

	// Direct snapshot updates from backend (emitted after creates)
	useEffect(() => {
		const onUpdate = (list: ConfigMapInfoRaw[] | null | undefined) => {
			try {
				const arr = Array.isArray(list) ? list : [];
				const filtered = arr.filter((cm) => namespaces.includes(cm?.namespace ?? cm?.Namespace ?? '') || (cm?.namespace ?? cm?.Namespace) === namespace);
				setData(normalizeConfigMaps(filtered));
				startFastPollingWindow();
			} catch (_) {
				// ignore malformed payloads
			}
		};
		EventsOn('configmaps:update', onUpdate);
		return () => {
			EventsOff('configmaps:update');
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [JSON.stringify(namespaces), namespace]);

	const analyzeConfigMap = async (row: ConfigMapRow) => {
		const key = `${row.namespace}/${row.name}`;
		const streamId = `configmap-${Date.now()}`;
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
			await AnalyzeConfigMapStream(row.namespace, row.name, streamId);
		} catch (err: unknown) {
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

	const getRowActions = (row: ConfigMapRow, api?: { openDetails?: (tabKey: string) => void }) => {
		const key = `${row.namespace}/${row.name}`;
		const isAnalyzing = holmesState.loading && holmesState.key === key;
		return [
			{
				label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
				icon: '🧠',
				disabled: isAnalyzing,
				onClick: () => {
					analyzeConfigMap(row);
					api?.openDetails?.('holmes');
				},
			},
			{
				label: 'Delete',
				icon: '🗑️',
				danger: true,
				onClick: async () => {
					try {
						await AppAPI.DeleteResource('configmap', row.namespace, row.name);
						showSuccess(`ConfigMap '${row.name}' deleted`);
					} catch (err: unknown) {
						const message = err instanceof Error ? err.message : String(err);
						showError(`Failed to delete ConfigMap '${row.name}': ${message}`);
					}
				},
			},
		];
	};

	return (
		<OverviewTableWithPanel
			title="Config Maps"
			data={data}
			columns={columns}
			loading={loading}
			error={error}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeConfigMap, cancelHolmesAnalysis)}
			resourceKind="configmap"
			namespace={namespace}
			onCreateResource={onConfigMapCreate}
			getRowActions={getRowActions}
		/>
	);
}

export { ConfigMapsOverviewTable };

