import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import SecretYamlTab from './SecretYamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SecretDataTab from './SecretDataTab';
import SecretConsumersTab from './SecretConsumersTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeSecretStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'namespace', label: 'Namespace' },
	{ key: 'type', label: 'Type' },
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

type SecretRow = {
	name: string;
	namespace: string;
	type: string;
	keys: number;
	size: string;
	age: string;
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

type SecretInfoRaw = {
	name?: string;
	namespace?: string;
	type?: string;
	keys?: number;
	size?: string;
	age?: string;
	labels?: Record<string, string>;
	Name?: string;
	Namespace?: string;
	Type?: string;
	Keys?: number;
	Size?: string;
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

const normalizeSecret = (secret: SecretInfoRaw): SecretRow => ({
	name: secret.name ?? secret.Name ?? '',
	namespace: secret.namespace ?? secret.Namespace ?? '',
	type: secret.type ?? secret.Type ?? '-',
	keys: secret.keys ?? secret.Keys ?? 0,
	size: secret.size ?? secret.Size ?? '-',
	age: secret.age ?? secret.Age ?? '-',
	labels: normalizeLabels(secret.labels ?? secret.Labels ?? secret.metadata?.labels),
});

function renderPanelContent(
	row: SecretRow,
	tab: string,
	holmesState: HolmesState,
	onAnalyze: (row: SecretRow) => void,
	onCancel: () => void
) {
	if (tab === 'summary') {
		const quickInfoFields = [
			{
				key: 'type',
				label: 'Type',
				layout: 'flex' as const,
				rightField: {
					key: 'age',
					label: 'Age',
					type: 'age' as const,
					getValue: (data: { created?: string; age?: string }) => data.created || data.age,
				},
			},
			{ key: 'namespace', label: 'Namespace' },
			{ key: 'keys', label: 'Keys' },
			{ key: 'size', label: 'Size' },
			{ key: 'name', label: 'Secret name', type: 'break-word' as const },
		];

		return (
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row.name}
					labels={row.labels}
					actions={(
						<ResourceActions
							resourceType="secret"
							name={row.name}
							namespace={row.namespace}
							onDelete={async () => {
								await AppAPI.DeleteResource('secret', row.namespace, row.name);
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
							<SecretDataTab namespace={row.namespace} secretName={row.name} />
						</div>
						<div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
							<ResourceEventsTab namespace={row.namespace} resourceKind="Secret" resourceName={row.name} limit={20} />
						</div>
					</div>
				</div>
			</div>
		);
	}
	if (tab === 'data') {
		return (
			<SecretDataTab
				namespace={row.namespace}
				secretName={row.name}
			/>
		);
	}
	if (tab === 'consumers') {
		return (
			<SecretConsumersTab
				namespace={row.namespace}
				secretName={row.name}
			/>
		);
	}
	if (tab === 'events') {
		return <ResourceEventsTab namespace={row.namespace} resourceKind="Secret" resourceName={row.name} />;
	}
	if (tab === 'yaml') {
		return <SecretYamlTab namespace={row.namespace} name={row.name} />;
	}
	if (tab === 'holmes') {
		const key = `${row.namespace}/${row.name}`;
		return (
			<HolmesBottomPanel
				kind="Secret"
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

type SecretsOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
	onSecretCreate?: () => void;
};

export default function SecretsOverviewTable({ namespaces, onSecretCreate }: SecretsOverviewTableProps) {
	const [data, setData] = useState<SecretRow[]>([]);
	const [_loading, setLoading] = useState(false);
	const [_error, setError] = useState<string | null>(null);
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

			let streamData: Record<string, unknown> | null;
			try {
				streamData = JSON.parse(payload.data);
			} catch {
				streamData = null;
			}

			if (eventType === 'ai_message' && streamData) {
				let handled = false;
				const reasoning = typeof streamData.reasoning === 'string' ? streamData.reasoning : '';
				if (reasoning) {
					setHolmesState((prev) => ({
						...prev,
						reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + reasoning,
					}));
					handled = true;
				}
				const content = typeof streamData.content === 'string' ? streamData.content : '';
				if (content) {
					setHolmesState((prev) => {
						const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + content;
						return { ...prev, streamingText: nextText, response: { response: nextText } };
					});
					handled = true;
				}
				if (handled) return;
			}

			if (eventType === 'start_tool_calling' && streamData && streamData.id !== undefined) {
				const id = String(streamData.id);
				const name = typeof streamData.tool_name === 'string' ? streamData.tool_name : 'tool';
				const description = typeof streamData.description === 'string' ? streamData.description : undefined;
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

			if (eventType === 'tool_calling_result' && streamData && streamData.tool_call_id !== undefined) {
				const toolId = String(streamData.tool_call_id);
				const result = streamData.result as { status?: unknown } | undefined;
				const status = typeof result?.status === 'string'
					? result.status
					: typeof streamData.status === 'string'
						? streamData.status
						: 'done';
				const description = typeof streamData.description === 'string' ? streamData.description : undefined;
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

			if (eventType === 'ai_answer_end' && streamData && typeof streamData.analysis === 'string') {
				const analysisText = streamData.analysis;
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
			try { unsubscribe?.(); } catch (_) { /* ignore */ }
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
			try { unsubscribe?.(); } catch (_) { /* ignore */ }
		};
	}, []);

	const normalize = (arr: unknown[]): SecretRow[] =>
		(arr || []).filter(Boolean).map((s) => normalizeSecret(s as SecretInfoRaw));

	const fetchAllSecrets = async () => {
		if (!Array.isArray(namespaces) || namespaces.length === 0) {
			setData([]);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const results = await Promise.all(
				namespaces.map((ns) => AppAPI.GetSecrets(ns).catch(() => []))
			);
			const flat = ([] as unknown[]).concat(...results).filter(Boolean);
			setData(normalize(flat));
		} catch (err) {
			console.error('Error fetching secrets:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch secrets');
			setData([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllSecrets();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [namespaces]);

	useEffect(() => {
		const onUpdate = (list: unknown) => {
			try {
				const arr = Array.isArray(list) ? list : [];
				setData(normalize(arr));
			} catch { /* ignore */ }
		};
		EventsOn('secrets:update', onUpdate);
		return () => { try { EventsOff('secrets:update'); } catch (_) { /* ignore */ } };
	}, [namespaces]);

	const analyzeSecret = async (row: SecretRow) => {
		const key = `${row.namespace}/${row.name}`;
		const streamId = `secret-${Date.now()}`;
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
			await AnalyzeSecretStream(row.namespace, row.name, streamId);
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

	const getRowActions = (row: SecretRow, api: { openDetails?: (tabKey?: string) => void }) => {
		const key = `${row.namespace}/${row.name}`;
		const isAnalyzing = holmesState.loading && holmesState.key === key;
		return [
			{
				label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
				icon: '🧠',
				disabled: isAnalyzing,
				onClick: () => {
					analyzeSecret(row);
					api?.openDetails?.('holmes');
				},
			},
			{
				label: 'Delete',
				icon: '🗑️',
				danger: true,
				onClick: async () => {
					try {
						await AppAPI.DeleteResource('secret', row.namespace, row.name);
						showSuccess(`Secret '${row.name}' deleted`);
					} catch (err) {
						showError(`Failed to delete Secret '${row.name}': ${err instanceof Error ? err.message : err}`);
					}
				},
			},
		];
	};

	return (
		<OverviewTableWithPanel
			columns={columns}
			data={data}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeSecret, cancelHolmesAnalysis)}
			title="Secrets"
			resourceKind="secret"
			namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
			onCreateResource={onSecretCreate}
			getRowActions={getRowActions}
		/>
	);
}

export { SecretsOverviewTable };
