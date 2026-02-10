import { useEffect, useRef, useState } from 'react';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import IngressYamlTab from './IngressYamlTab';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import IngressRulesTab from './IngressRulesTab';
import IngressTLSTab from './IngressTLSTab';
import IngressBackendServicesTab from './IngressBackendServicesTab';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import ResourceActions from '../../../components/ResourceActions';
import { showSuccess, showError } from '../../../notification';
import { AnalyzeIngressStream, CancelHolmesStream, onHolmesContextProgress, onHolmesChatStream } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse, HolmesContextProgressEvent } from '../../../holmes/holmesApi';
import type { app } from '../../../../wailsjs/go/models';

const columns = [
	{ key: 'name', label: 'Name' },
	{ key: 'namespace', label: 'Namespace' },
	{ key: 'class', label: 'Class' },
	{ key: 'hosts', label: 'Hosts', render: (value: unknown) => Array.isArray(value) ? value.join(', ') : '-' },
	{ key: 'address', label: 'Address' },
	{ key: 'ports', label: 'Ports' },
	{ key: 'age', label: 'Age' },
];

const bottomTabs = [
	{ key: 'summary', label: 'Summary', countable: false },
	{ key: 'rules', label: 'Rules', countKey: 'rules' },
	{ key: 'tls', label: 'TLS', countable: false },
	{ key: 'services', label: 'Backend Services', countable: false },
	{ key: 'events', label: 'Events', countKey: 'events' },
	{ key: 'yaml', label: 'YAML', countable: false },
	{ key: 'holmes', label: 'Holmes', countable: false },
];

function renderPanelContent(
	row: IngressRow,
	tab: string,
	holmesState: HolmesState,
	onAnalyze: (row: IngressRow) => void,
	onCancel: () => void
) {
	if (tab === 'summary') {
		const quickInfoFields: QuickInfoField[] = [
			{
				key: 'class',
				label: 'Class',
				layout: 'flex',
				rightField: {
					key: 'age',
					label: 'Age',
					type: 'age',
					getValue: (data: Record<string, unknown>) => {
						const rowData = data as IngressRow;
						return rowData.created || rowData.age;
					},
				},
			},
			{ key: 'namespace', label: 'Namespace' },
			{
				key: 'hosts',
				label: 'Hosts',
				getValue: (data: Record<string, unknown>) => {
					const rowData = data as IngressRow;
					return Array.isArray(rowData.hosts) ? rowData.hosts.join(', ') : '-';
				},
			},
			{ key: 'address', label: 'Address' },
			{ key: 'ports', label: 'Ports' },
			{ key: 'name', label: 'Ingress name', type: 'break-word' },
		];

		return (
			<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<SummaryTabHeader
					name={row.name}
					labels={row.labels}
					actions={
						<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
							<button
								type="button"
								disabled={!Array.isArray(row.hosts) || row.hosts.length === 0}
								onClick={() => {
									try {
										const host = Array.isArray(row.hosts) && row.hosts.length ? row.hosts[0] : null;
										if (!host) return;
										// Check if TLS is configured for this host
										const hasTLS = Array.isArray(row.tls) && row.tls.some((tlsConfig) => {
											const hosts = (tlsConfig as { hosts?: string[] | null }).hosts;
											return !hosts || hosts.length === 0 || hosts.includes(host);
										});
										const protocol = hasTLS ? 'https' : 'http';
										const url = `${protocol}://${host}`;
										window.open(url, '_blank', 'noopener,noreferrer');
										showSuccess(`Opening ${url}`);
									} catch (e: unknown) {
										const message = e instanceof Error ? e.message : String(e);
										showError(`Failed to open endpoint: ${message}`);
									}
								}}
								title={(Array.isArray(row.hosts) && row.hosts.length) ? 'Open first host in browser' : 'No hosts available'}
								style={{
									padding: '4px 10px',
									fontSize: 12,
									display: 'inline-flex',
									alignItems: 'center',
									gap: 6,
									borderRadius: 4,
									border: '1px solid #353a42',
									background: '#2d323b',
									color: '#fff',
									cursor: (Array.isArray(row.hosts) && row.hosts.length) ? 'pointer' : 'not-allowed',
									opacity: (Array.isArray(row.hosts) && row.hosts.length) ? 1 : 0.6,
								}}
							>
								Test Endpoint
							</button>
								<ResourceActions
								resourceType="ingress"
								name={row.name}
								namespace={row.namespace}
								onDelete={async (n, ns) => {
									const targetNamespace = ns || row.namespace;
									if (!n || !targetNamespace) return;
									await AppAPI.DeleteResource('ingress', targetNamespace, n);
								}}
							/>
						</div>
					}
				/>
				{/* Main content */}
				<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
					<QuickInfoSection
						resourceName={row.name}
						data={row}
						loading={false}
						error={null}
						fields={quickInfoFields}
					/>
					{/* Event History at a glance */}
					<div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
						<ResourceEventsTab namespace={row.namespace} resourceKind="Ingress" resourceName={row.name} limit={20} />
					</div>
				</div>
			</div>
		);
	}
	if (tab === 'rules') {
		return <IngressRulesTab namespace={row.namespace} ingressName={row.name} hosts={row.hosts} />;
	}
	if (tab === 'tls') {
		return <IngressTLSTab namespace={row.namespace} ingressName={row.name} />;
	}
	if (tab === 'services') {
		return <IngressBackendServicesTab namespace={row.namespace} ingressName={row.name} />;
	}
	if (tab === 'events') {
		return <ResourceEventsTab namespace={row.namespace} resourceKind="Ingress" resourceName={row.name} />;
	}
	if (tab === 'yaml') {
		return <IngressYamlTab namespace={row.namespace} name={row.name} />;
	}
	if (tab === 'holmes') {
		const key = `${row.namespace}/${row.name}`;
		return (
			<HolmesBottomPanel
				kind="Ingress"
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

type IngressRow = {
	name: string;
	namespace: string;
	class: string;
	hosts: string[];
	tls: unknown[];
	address: string;
	ports: string;
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

type IngressInfoRaw = app.IngressInfo & {
	Name?: string;
	Namespace?: string;
	Class?: string;
	Hosts?: string[];
	Tls?: unknown[];
	TLS?: unknown[];
	Address?: string;
	Ports?: string;
	Age?: string;
	Labels?: Record<string, string>;
	metadata?: { labels?: Record<string, string> };
	tls?: unknown[];
};

const normalizeLabels = (labels?: Record<string, string> | null) => {
	if (!labels) return {};
	return Object.entries(labels).reduce<Record<string, string>>((acc, [key, value]) => {
		acc[key] = String(value ?? '');
		return acc;
	}, {});
};

const normalizeIngress = (ingress: IngressInfoRaw): IngressRow => {
	const rawHosts = ingress.hosts ?? ingress.Hosts ?? [];
	const hosts = Array.isArray(rawHosts) ? rawHosts.filter(Boolean).map(String) : [];
	const tls = ingress.tls ?? ingress.Tls ?? ingress.TLS ?? [];

	return {
		name: ingress.name ?? ingress.Name ?? '',
		namespace: ingress.namespace ?? ingress.Namespace ?? '',
		class: ingress.class ?? ingress.Class ?? '-',
		hosts,
		tls: Array.isArray(tls) ? tls : [],
		address: ingress.address ?? ingress.Address ?? '-',
		ports: ingress.ports ?? ingress.Ports ?? '-',
		age: ingress.age ?? ingress.Age ?? '-',
		labels: normalizeLabels(ingress.labels ?? ingress.Labels ?? ingress.metadata?.labels),
	};
};

type IngressesOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
	onIngressCreate?: () => void;
};

function panelHeader(row: IngressRow) {
	return <span style={{ fontWeight: 600 }}>{row.name}</span>;
}

export default function IngressesOverviewTable({ namespaces, onIngressCreate }: IngressesOverviewTableProps) {
	const [ingresses, setIngresses] = useState<IngressRow[]>([]);
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

	const normalize = (arr: IngressInfoRaw[] | null | undefined) => (arr || []).filter(Boolean).map(normalizeIngress);

	const fetchAllIngresses = async () => {
		if (!Array.isArray(namespaces) || namespaces.length === 0) {
			setIngresses([]);
			return;
		}
		setLoading(true);
		try {
			const results = await Promise.all(
				namespaces.map((ns) => AppAPI.GetIngresses(ns).catch(() => [] as app.IngressInfo[]))
			);
			const flat = results.flat();
			setIngresses(normalize(flat));
		} catch (error) {
			console.error('Failed to fetch ingresses:', error);
			setIngresses([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAllIngresses();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [namespaces]);

	// Subscribe to backend updates to refresh automatically
	useEffect(() => {
		const onUpdate = (list: IngressInfoRaw[] | null | undefined) => {
			try {
				const arr = Array.isArray(list) ? list : [];
				const filtered = namespaces
					? arr.filter((i) => namespaces.includes(i?.namespace ?? i?.Namespace ?? ''))
					: arr;
				setIngresses(normalize(filtered));
			} catch (_e) {
				// ignore malformed payloads
			}
		};
		EventsOn('ingresses:update', onUpdate);
		return () => {
			EventsOff('ingresses:update');
		};
	}, [namespaces]);

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

			let data;
			try {
				data = JSON.parse(payload.data);
			} catch {
				data = null;
			}

			if (eventType === 'ai_message' && data) {
				let handled = false;
				if (data.reasoning) {
					setHolmesState((prev) => ({
						...prev,
						reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + data.reasoning,
					}));
					handled = true;
				}
				if (data.content) {
					setHolmesState((prev) => {
						const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + data.content;
						return { ...prev, streamingText: nextText, response: { response: nextText } };
					});
					handled = true;
				}
				if (handled) return;
			}

			if (eventType === 'start_tool_calling' && data && data.id) {
				setHolmesState((prev) => ({
					...prev,
					toolEvents: [...(prev.toolEvents || []), {
						id: data.id,
						name: data.tool_name || 'tool',
						status: 'running',
						description: data.description,
					}],
				}));
				return;
			}

			if (eventType === 'tool_calling_result' && data && data.tool_call_id) {
				const status = data.result?.status || data.status || 'done';
				setHolmesState((prev) => ({
					...prev,
					toolEvents: (prev.toolEvents || []).map((item) =>
						item.id === data.tool_call_id
							? { ...item, status, description: data.description || item.description }
							: item
					),
				}));
				return;
			}

			if (eventType === 'ai_answer_end' && data && data.analysis) {
				setHolmesState((prev) => ({
					...prev,
					loading: false,
					response: { response: data.analysis },
					streamingText: data.analysis,
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
		const unsubscribe = onHolmesContextProgress((event: HolmesContextProgressEvent) => {
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

	const analyzeIngress = async (row: IngressRow) => {
		const key = `${row.namespace}/${row.name}`;
		const streamId = `ingress-${Date.now()}`;
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
			await AnalyzeIngressStream(row.namespace, row.name, streamId);
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

	const getRowActions = (row: IngressRow, api?: { openDetails?: (tabKey: string) => void }) => {
		const key = `${row.namespace}/${row.name}`;
		const isAnalyzing = holmesState.loading && holmesState.key === key;
		return [
			{
				label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
				icon: '🧠',
				disabled: isAnalyzing,
				onClick: () => {
					analyzeIngress(row);
					api?.openDetails?.('holmes');
				},
			},
			{
				label: 'Test Endpoint',
				icon: '🔗',
				disabled: !Array.isArray(row.hosts) || row.hosts.length === 0,
				onClick: () => {
					try {
						const host = Array.isArray(row.hosts) && row.hosts.length ? row.hosts[0] : null;
						if (!host) return;
						const url = `https://${host}`;
						window.open(url, '_blank', 'noopener,noreferrer');
						showSuccess(`Opening ${url}`);
					} catch (e: unknown) {
						const message = e instanceof Error ? e.message : String(e);
						showError(`Failed to open endpoint: ${message}`);
					}
				},
			},
			{
				label: 'Delete',
				icon: '🗑️',
				danger: true,
				onClick: async () => {
					try {
						await AppAPI.DeleteResource('ingress', row.namespace, row.name);
						showSuccess(`Ingress '${row.name}' deleted`);
					} catch (err: unknown) {
						const message = err instanceof Error ? err.message : String(err);
						showError(`Failed to delete Ingress '${row.name}': ${message}`);
					}
				},
			},
		];
	};

	return (
		<OverviewTableWithPanel
			title="Ingresses"
			columns={columns}
			data={ingresses}
			loading={loading}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzeIngress, cancelHolmesAnalysis)}
			panelHeader={panelHeader}
			resourceKind="ingress"
			namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
			onCreateResource={onIngressCreate}
			getRowActions={getRowActions}
		/>
	);
}

export { IngressesOverviewTable };
