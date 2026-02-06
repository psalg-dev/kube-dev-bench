import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection from '../../../QuickInfoSection';
import ServiceYamlTab from './ServiceYamlTab';
import ServiceEndpointsTab from './ServiceEndpointsTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeServiceStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import type { app } from '../../../../wailsjs/go/models';

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'namespace', label: 'Namespace' },
	{ key: 'type', label: 'Type' },
	{ key: 'clusterIP', label: 'Cluster IP' },
	{ key: 'ports', label: 'Ports' },
	{ key: 'age', label: 'Age' },
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary', countable: false },
	{ key: 'endpoints', label: 'Endpoints', countKey: 'endpoints' },
	{ key: 'events', label: 'Events', countKey: 'events' },
	{ key: 'yaml', label: 'YAML', countable: false },
	{ key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(
	row: ServiceRow,
	tab: string,
	holmesState: HolmesState,
	onAnalyze: (row: ServiceRow) => void,
	onCancel: () => void
) {
	if (tab === 'summary') {
		const quickInfoFields = [
			{ key: 'name', label: 'Service name', type: 'break-word' as const },
			{ key: 'namespace', label: 'Namespace' },
			{ key: 'type', label: 'Type' },
			{ key: 'clusterIP', label: 'Cluster IP' },
			{ key: 'ports', label: 'Ports' },
			{ key: 'age', label: 'Age' },
		];

		return (
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row.name}
					labels={row.labels}
					actions={(
						<ResourceActions
							resourceType="service"
							name={row.name}
							namespace={row.namespace}
							onDelete={async () => {
								await AppAPI.DeleteResource('service', row.namespace, row.name);
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
					<div style={{ width: 420, minWidth: 300, minHeight: 0, borderLeft: '1px solid var(--gh-border, #30363d)', position: 'relative' }}>
						<ResourceEventsTab
							namespace={row.namespace}
							kind="Service"
							name={row.name}
							limit={20}
						/>
					</div>
				</div>
			</div>
		);
	}

	if (tab === 'endpoints') {
		return <ServiceEndpointsTab namespace={row.namespace} serviceName={row.name} />;
	}

	if (tab === 'events') {
		return (
			<ResourceEventsTab
				namespace={row.namespace}
				kind="Service"
				name={row.name}
			/>
		);
	}

	if (tab === 'yaml') {
		return <ServiceYamlTab namespace={row.namespace} name={row.name} />;
	}

	if (tab === 'holmes') {
		const key = `${row.namespace}/${row.name}`;
		return (
			<HolmesBottomPanel
				kind="Service"
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

type ServiceRow = {
	name: string;
	namespace: string;
	type: string;
	clusterIP: string;
	ports: string;
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

type ServiceInfoRaw = app.ServiceInfo & {
	Name?: string;
	Namespace?: string;
	Type?: string;
	ClusterIP?: string;
	Ports?: string;
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

const normalizeService = (svc: ServiceInfoRaw): ServiceRow => ({
	name: svc.name ?? svc.Name ?? '',
	namespace: svc.namespace ?? svc.Namespace ?? '',
	type: svc.type ?? svc.Type ?? '-',
	clusterIP: svc.clusterIP ?? svc.ClusterIP ?? '-',
	ports: svc.ports ?? svc.Ports ?? '-',
	age: svc.age ?? svc.Age ?? '-',
	labels: normalizeLabels(svc.labels ?? svc.Labels ?? svc.metadata?.labels),
});

type ServicesOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
};

export default function ServicesOverviewTable({ namespaces, namespace }: ServicesOverviewTableProps) {
	const [services, setServices] = useState<ServiceRow[]>([]);
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

	const refreshServices = async () => {
		const nsArr = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : (namespace ? [namespace] : []);
		if (nsArr.length === 0) return;
		try {
			setLoading(true);
			const lists = await Promise.all(nsArr.map((ns) => AppAPI.GetServices(ns).catch(() => [])));
			const flat = lists.flat().map((svc) => normalizeService(svc as ServiceInfoRaw));
			setServices(flat);
		} catch (_) {
			setServices([]);
		} finally {
			setLoading(false);
		}
	};

	/* eslint-disable react-hooks/exhaustive-deps */
	useEffect(() => {
		refreshServices();
	}, [namespaces, namespace]);
	/* eslint-enable react-hooks/exhaustive-deps */

	/* eslint-disable react-hooks/exhaustive-deps */
	useEffect(() => {
		const onUpdate = (eventData: { resource?: string; namespace?: string } | null) => {
			const res = (eventData?.resource || '').toString().toLowerCase();
			if (res !== 'service' && res !== 'services') return;
			const ns = (eventData?.namespace || '').toString();
			const selected = Array.isArray(namespaces) && namespaces.length > 0 ? namespaces : [namespace];
			if (ns && !selected.includes(ns)) return;
			refreshServices();
		};

		EventsOn('resource-updated', onUpdate);
		return () => { try { EventsOff('resource-updated'); } catch (_) { /* ignore */ } };
	}, [namespaces, namespace]);
	/* eslint-enable react-hooks/exhaustive-deps */

	useEffect(() => {
		const onUpdate = (list: unknown) => {
			try {
				const arr = Array.isArray(list) ? list : [];
				const norm = arr.map((svc) => normalizeService(svc as ServiceInfoRaw));
				setServices(norm);
			} catch (_) {
				setServices([]);
			} finally {
				setLoading(false);
			}
		};

		EventsOn('services:update', onUpdate);
		return () => { try { EventsOff('services:update'); } catch (_) { /* ignore */ } };
	}, []);

	const analyzeService = async (row: ServiceRow) => {
		const key = `${row.namespace}/${row.name}`;
		const streamId = `service-${Date.now()}`;
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
			await AnalyzeServiceStream(row.namespace, row.name, streamId);
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

	const getRowActions = (row: ServiceRow, api: { openDetails?: (tabKey?: string) => void }) => {
		const key = `${row.namespace}/${row.name}`;
		const isAnalyzing = holmesState.loading && holmesState.key === key;
		return [
			{
				label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
				icon: '🧠',
				disabled: isAnalyzing,
				onClick: () => {
					analyzeService(row);
					api?.openDetails?.('holmes');
				},
			},
			{
				label: 'Delete',
				icon: '🗑️',
				danger: true,
				onClick: async () => {
					try {
						await AppAPI.DeleteResource('service', row.namespace, row.name);
						showSuccess(`Service '${row.name}' deleted`);
					} catch (err) {
						showError(`Failed to delete service '${row.name}': ${err instanceof Error ? err.message : err}`);
					}
				},
			},
		];
	};

	return (
		<OverviewTableWithPanel
			columns={columns}
			data={services}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeService, cancelHolmesAnalysis)}
			panelHeader={(row) => <span style={{ fontWeight: 600 }}>{row.name}</span>}
			title="Services"
			loading={loading}
			resourceKind="service"
			namespace={namespace}
			getRowActions={getRowActions}
		/>
	);
}

export { ServicesOverviewTable };
