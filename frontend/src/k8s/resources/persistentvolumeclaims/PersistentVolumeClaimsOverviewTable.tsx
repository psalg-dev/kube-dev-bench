import { useEffect, useRef, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import type { app } from '../../../../wailsjs/go/models';
import { EventsOn } from '../../../../wailsjs/runtime';
import ResourceActions from '../../../components/ResourceActions';
import ResourceEventsTab from '../../../components/ResourceEventsTab';
import { AnalyzePersistentVolumeClaimStream, CancelHolmesStream, onHolmesChatStream, onHolmesContextProgress } from '../../../holmes/holmesApi';
import HolmesBottomPanel, { type HolmesContextStep, type HolmesToolEvent } from '../../../holmes/HolmesBottomPanel';
import type { HolmesResponse } from '../../../holmes/HolmesResponseRenderer';
import FilesTab from '../../../layout/bottompanel/FilesTab';
import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { showError, showSuccess } from '../../../notification';
import type { QuickInfoField } from '../../../QuickInfoSection';
import QuickInfoSection from '../../../QuickInfoSection';
import { ResourceGraphTab } from '../../graph/ResourceGraphTab';
import PersistentVolumeClaimYamlTab from './PersistentVolumeClaimYamlTab';
import PVCBoundPVTab from './PVCBoundPVTab';
import PVCConsumersTab from './PVCConsumersTab';
type PersistentVolumeClaimsOverviewTableProps = {
	namespaces?: string[];
	namespace?: string;
	onPVCCreate?: () => void;
};

type PvcRow = {
	name: string;
	namespace: string;
	status: string;
	storage: string;
	accessModes: string;
	volumeName: string;
	age: string;
	labels: Record<string, string>;
	Labels?: Record<string, string>;
	metadata?: { labels?: Record<string, string> };
	created?: string;
};

type PvcRowRaw = app.PersistentVolumeClaimInfo & {
	Name?: string;
	Namespace?: string;
	Status?: string;
	storage?: string;
	Storage?: string;
	AccessModes?: string[] | string;
	volumeName?: string;
	VolumeName?: string;
	Age?: string;
	Labels?: Record<string, string>;
	metadata?: { labels?: Record<string, string> };
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

export default function PersistentVolumeClaimsOverviewTable({ namespaces, onPVCCreate }: PersistentVolumeClaimsOverviewTableProps) {
	const [pvcs, setPVCs] = useState<PvcRow[]>([]);
	const [loading, setLoading] = useState(true);
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

	// Normalize PVC data
	const normalize = (arr: PvcRowRaw[] | null | undefined): PvcRow[] => (arr || []).filter(Boolean).map((i) => {
		const modes = i.accessModes ?? i.AccessModes;
		const modesText = Array.isArray(modes) ? modes.join(', ') : (modes ? String(modes) : '-');
		return {
			name: i.name ?? i.Name ?? '',
			namespace: i.namespace ?? i.Namespace ?? '',
			status: i.status ?? i.Status ?? '-',
			storage: i.storage ?? i.Storage ?? '-',
			accessModes: modesText,
			volumeName: i.volumeName ?? i.VolumeName ?? '-',
			age: i.age ?? i.Age ?? '-',
			labels: i.labels ?? i.Labels ?? i.metadata?.labels ?? {},
			Labels: i.Labels,
			metadata: i.metadata,
			created: (i as { created?: string }).created,
		};
	});

	// Fetch PVCs for all selected namespaces
	const fetchAllPVCs = async (isInitialLoad = false) => {
		if (!Array.isArray(namespaces) || namespaces.length === 0) {
			setPVCs([]);
			return;
		}
		if (isInitialLoad) {
			setLoading(true);
		}
		setError(null);
		try {
			const results = await Promise.all(
				namespaces.map(ns => AppAPI.GetPersistentVolumeClaims(ns).catch(() => []))
			);
			const combined = results.flat() as PvcRowRaw[];
			setPVCs(normalize(combined));
		} catch (err) {
			console.error('Error fetching PVCs:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch persistent volume claims');
			if (isInitialLoad) {
				setPVCs([]);
			}
		} finally {
			if (isInitialLoad) {
				setLoading(false);
			}
		}
	};

	useEffect(() => {
		fetchAllPVCs(true); // Initial load
		// Start a fast window when view opens
		clearTimers();
		let elapsed = 0;
		if (Array.isArray(namespaces) && namespaces.length > 0) {
			fastTimerRef.current = window.setInterval(async () => {
				await fetchAllPVCs(false); // Subsequent refreshes without loading state
				elapsed += 1;
				if (elapsed >= 60) {
					if (fastTimerRef.current) {
						clearInterval(fastTimerRef.current);
						fastTimerRef.current = null;
					}
					slowTimerRef.current = window.setInterval(() => fetchAllPVCs(false), 60000);
				}
			}, 1000);
		}
		return () => clearTimers();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [namespaces]);

	// Generic resource-updated fallback
	useEffect(() => {
		const onUpdate = (eventData: { resource?: string; namespace?: string } | null | undefined) => {
			const targetNs = eventData?.namespace;
			if (eventData?.resource === 'persistentvolumeclaim' && (!namespaces || (targetNs && namespaces.includes(targetNs)))) {
				fetchAllPVCs(false); // Refresh without loading state
				clearTimers();
				let elapsed = 0;
				if (Array.isArray(namespaces) && namespaces.length > 0) {
					fastTimerRef.current = window.setInterval(async () => {
						await fetchAllPVCs(false); // Subsequent refreshes without loading state
						elapsed += 1;
						if (elapsed >= 60) {
							if (fastTimerRef.current) {
								clearInterval(fastTimerRef.current);
								fastTimerRef.current = null;
							}
							slowTimerRef.current = window.setInterval(() => fetchAllPVCs(false), 60000);
						}
					}, 1000);
				}
			}
		};
		const unsubscribe = EventsOn('resource-updated', onUpdate);
		return () => {
			try { unsubscribe?.(); } catch {}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				setHolmesState((prev) => ({ ...prev, loading: false, error: payload.error ?? null }));
				return;
			}

			const eventType = payload.event;
			if (!payload.data) {
				return;
			}

			let streamData;
			try {
				streamData = JSON.parse(payload.data);
			} catch {
				streamData = null;
			}

			if (eventType === 'ai_message' && streamData) {
				let handled = false;
				if (streamData.reasoning) {
					setHolmesState((prev) => ({
						...prev,
						reasoningText: (prev.reasoningText ? prev.reasoningText + '\n' : '') + streamData.reasoning,
					}));
					handled = true;
				}
				if (streamData.content) {
					setHolmesState((prev) => {
						const nextText = (prev.streamingText ? prev.streamingText + '\n' : '') + streamData.content;
						return { ...prev, streamingText: nextText, response: { response: nextText } };
					});
					handled = true;
				}
				if (handled) return;
			}

			if (eventType === 'start_tool_calling' && streamData && streamData.id) {
				setHolmesState((prev) => ({
					...prev,
					toolEvents: [...(prev.toolEvents || []), {
						id: streamData.id,
						name: streamData.tool_name || 'tool',
						status: 'running',
						description: streamData.description,
					}],
				}));
				return;
			}

			if (eventType === 'tool_calling_result' && streamData && streamData.tool_call_id) {
				const status = streamData.result?.status || streamData.status || 'done';
				setHolmesState((prev) => ({
					...prev,
					toolEvents: (prev.toolEvents || []).map((item) =>
						item.id === streamData.tool_call_id
							? { ...item, status, description: streamData.description || item.description }
							: item
					),
				}));
				return;
			}

			if (eventType === 'ai_answer_end' && streamData && streamData.analysis) {
				setHolmesState((prev) => ({
					...prev,
					loading: false,
					response: { response: streamData.analysis },
					streamingText: streamData.analysis,
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
			try { unsubscribe?.(); } catch { /* ignore */ }
		};
	}, []);

	const columns = [
		{ key: 'name', label: 'Name' },
		{ key: 'namespace', label: 'Namespace' },
		{ key: 'status', label: 'Status' },
		{ key: 'storage', label: 'Storage' },
		{ key: 'accessModes', label: 'Access Modes' },
		{ key: 'volumeName', label: 'Volume' },
		{ key: 'age', label: 'Age' }
	];

	const bottomTabs = [
		{ key: 'summary', label: 'Summary', countable: false },
		{ key: 'boundpv', label: 'Bound PV', countable: false },
		{ key: 'consumers', label: 'Consumers', countKey: 'consumers' },
		{ key: 'events', label: 'Events', countKey: 'events' },
		{ key: 'yaml', label: 'YAML', countable: false },
		{ key: 'files', label: 'Files', countable: false },
		{ key: 'relationships', label: 'Relationships', countable: false, testId: 'relationships-tab' },
		{ key: 'holmes', label: 'Holmes', countable: false },
	];

	function renderPanelContent(
		row: PvcRow,
		tab: string,
		holmesState: HolmesState,
		onAnalyze: (_item: PvcRow) => void,
		onCancel: () => void
	) {
		if (tab === 'summary') {
			const quickInfoFields: QuickInfoField[] = [
				{
					key: 'status',
					label: 'Status',
					type: 'status',
					layout: 'flex',
					rightField: {
						key: 'age',
						label: 'Age',
						type: 'age',
						getValue: (data: Record<string, unknown>) => (data as PvcRow).created || (data as PvcRow).age
					}
				},
				{ key: 'namespace', label: 'Namespace' },
				{ key: 'storage', label: 'Storage' },
				{ key: 'accessModes', label: 'Access Modes' },
				{ key: 'volumeName', label: 'Volume Name' },
				{ key: 'name', label: 'PVC name', type: 'break-word' }
			];

			return (
				<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
					<SummaryTabHeader name={row.name} labels={row.labels || row.Labels || row.metadata?.labels} actions={<ResourceActions resourceType="pvc" name={row.name} namespace={row.namespace} onDelete={async (n, ns) => { const resolvedNs = ns ?? row.namespace; if (resolvedNs) await AppAPI.DeleteResource('pvc', resolvedNs, n); }} />} />
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
							<ResourceEventsTab namespace={row.namespace} resourceKind="PersistentVolumeClaim" resourceName={row.name} limit={20} />
						</div>
					</div>
				</div>
			);
		}
		if (tab === 'yaml') {
			return <PersistentVolumeClaimYamlTab namespace={row.namespace} name={row.name} />;
		}
		if (tab === 'events') {
			return <ResourceEventsTab namespace={row.namespace} resourceKind="PersistentVolumeClaim" resourceName={row.name} />;
		}
		if (tab === 'boundpv') {
			return <PVCBoundPVTab namespace={row.namespace} pvcName={row.name} pvName={row.volumeName} />;
		}
		if (tab === 'consumers') {
			return <PVCConsumersTab namespace={row.namespace} pvcName={row.name} />;
		}
		if (tab === 'files') {
			return <FilesTab namespace={row.namespace} pvcName={row.name} />;
		}
		if (tab === 'relationships') {
			return <ResourceGraphTab namespace={row.namespace} kind="PersistentVolumeClaim" name={row.name} />;
		}
		if (tab === 'holmes') {
			const key = `${row.namespace}/${row.name}`;
			return (
				<HolmesBottomPanel
					kind="PersistentVolumeClaim"
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

	function panelHeader(row: PvcRow) {
		return <span style={{ fontWeight: 600 }}>{row.name}</span>;
	}

	if (loading) {
		return (
			<div style={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				height: '200px',
				color: 'var(--gh-text-muted)'
			}}>
				Loading Persistent Volume Claims...
			</div>
		);
	}
	if (error) {
		return (
			<div style={{
				padding: '20px',
				color: '#dc3545',
				backgroundColor: 'var(--gh-danger-bg)',
				border: '1px solid var(--gh-danger-border)',
				borderRadius: '6px',
				margin: '20px'
			}}>
				Error loading Persistent Volume Claims: {error}
			</div>
		);
	}

	const analyzePersistentVolumeClaim = async (row: PvcRow) => {
		const key = `${row.namespace}/${row.name}`;
		const streamId = `pvc-${Date.now()}`;
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
			await AnalyzePersistentVolumeClaimStream(row.namespace, row.name, streamId);
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

	const getRowActions = (row: PvcRow, api: { openDetails?: (_tab?: string) => void }) => {
		const key = `${row.namespace}/${row.name}`;
		const isAnalyzing = holmesState.loading && holmesState.key === key;
		return [
			{
				label: isAnalyzing ? 'Analyzing...' : 'Ask Holmes',
				icon: '🧠',
				disabled: isAnalyzing,
				onClick: () => {
					analyzePersistentVolumeClaim(row);
					api?.openDetails?.('holmes');
				},
			},
			{
				label: 'Delete',
				icon: '🗑️',
				danger: true,
				onClick: async () => {
					try {
						await AppAPI.DeleteResource('pvc', row.namespace, row.name);
						showSuccess(`PVC '${row.name}' deleted`);
					} catch (err) {
						showError(`Failed to delete PVC '${row.name}': ${err instanceof Error ? err.message : String(err)}`);
					}
				},
			},
		];
	};

	return (
		<OverviewTableWithPanel
			title="Persistent Volume Claims"
			columns={columns}
			data={pvcs}
			loading={loading}
			tabs={bottomTabs}
			renderPanelContent={(row, tab) => renderPanelContent(row, tab, holmesState, analyzePersistentVolumeClaim, cancelHolmesAnalysis)}
			panelHeader={panelHeader}
			resourceKind="persistentvolumeclaim"
			namespace={namespaces && namespaces.length === 1 ? namespaces[0] : ''}
			onCreateResource={onPVCCreate}
			getRowActions={getRowActions}
		/>
	);
}

export { PersistentVolumeClaimsOverviewTable };
