import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { swarmServiceConfig } from '../../../config/resourceConfigs/swarm/serviceConfig';
import ImageUpdateModal from './ImageUpdateModal';
import ImageUpdateSettingsModal from './ImageUpdateSettingsModal';
import { BaseModal, ModalButton, ModalDangerButton, ModalPrimaryButton } from '../../../components/BaseModal';
import { showSuccess, showError } from '../../../notification';
import { ScaleSwarmService, RemoveSwarmService } from '../../../docker/swarmApi';
import type { HolmesHelpers, PanelApi, ResourceRow } from '../../../types/resourceConfigs';

// ponytail: services carries image-update glue the config can't hold (event merge, badge onOpenDetails, modals).
function mergeImageUpdateMap(prev: ResourceRow[], updates: Record<string, unknown> | null | undefined): ResourceRow[] {
	if (!updates || typeof updates !== 'object' || !Array.isArray(prev)) return prev;
	return prev.map((s) => {
		const id = s?.id;
		if (!id) return s;
		const u = (updates as Record<string, { updateAvailable?: boolean; localDigest?: string; remoteDigest?: string; checkedAt?: string }>)[id];
		if (!u) return s;
		const imageUpdateAvailable = Boolean(u.updateAvailable);
		const imageLocalDigest = String(u.localDigest || '').trim();
		const imageRemoteDigest = String(u.remoteDigest || '').trim();
		const imageCheckedAt = String(u.checkedAt || '').trim();
		return {
			...s,
			imageUpdateAvailable,
			imageLocalDigest,
			imageRemoteDigest,
			imageCheckedAt,
			imageUpdate: { ...(s.imageUpdate as object || {}), imageUpdateAvailable, imageLocalDigest, imageRemoteDigest, imageCheckedAt },
		};
	});
}

const decorate = (list: unknown): ResourceRow[] =>
	(Array.isArray(list) ? list : []).map((s) => swarmServiceConfig.normalize?.(s) ?? s) as ResourceRow[];

export default function SwarmServicesOverviewTable() {
  const [services, setServices] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [imageUpdateServiceId, setImageUpdateServiceId] = useState<string | null>(null);
  const [imageUpdateSettingsOpen, setImageUpdateSettingsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'scale' | 'delete'; row: ResourceRow } | null>(null);
  const [scaleValue, setScaleValue] = useState<string>('');
  const scaleInputRef = useRef<HTMLInputElement>(null);

	const { state, analyze, cancel } = useHolmesAnalysis({
		kind: swarmServiceConfig.resourceKind,
		analyzeFn: swarmServiceConfig.analyzeFn as (..._args: string[]) => Promise<void>,
		keyPrefix: swarmServiceConfig.holmesKeyPrefix,
	});
	const helpers: HolmesHelpers = { holmesState: state, analyze, cancel };

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

  const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

  const handleScaleConfirm = useCallback(async () => {
    if (!pendingAction?.row) return;
    const desired = Number(scaleValue);
    if (!Number.isFinite(desired) || desired < 0) {
      showError('Replica count must be a non-negative number.');
      return;
    }
    const serviceId = pendingAction.row?.id;
    if (!serviceId) {
      showError('Missing service id');
      setPendingAction(null);
      return;
    }
    try {
      await ScaleSwarmService(serviceId, Math.floor(desired));
      showSuccess(`Scaled service ${pendingAction.row.name} to ${Math.floor(desired)} replicas`);
      setPendingAction(null);
      setScaleValue('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to scale service: ${message}`);
    }
  }, [pendingAction, scaleValue]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingAction?.row) return;
    const serviceId = pendingAction.row?.id;
    if (!serviceId) {
      showError('Missing service id');
      setPendingAction(null);
      return;
    }
    try {
      await RemoveSwarmService(serviceId);
      showSuccess(`Removed service ${pendingAction.row.name}`);
      setPendingAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to remove service: ${message}`);
    }
  }, [pendingAction]);

  useEffect(() => {
		let active = true;

		const load = async () => {
			try {
				const data = await swarmServiceConfig.fetchFn?.();
				if (active) {
					setServices(decorate(data));
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load Swarm services:', err);
				if (active) {
					setServices([]);
					setLoading(false);
				}
			}
		};

		load();

		const off = EventsOn(swarmServiceConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setServices(decorate(data));
			} else {
				refresh();
			}
		});

		const offUpdates = EventsOn('swarm:image:updates', (updates) => {
			if (!active) return;
			setServices((prev) => mergeImageUpdateMap(prev, updates as Record<string, unknown>));
		});

		return () => {
			active = false;
			if (typeof off === 'function') off();
			if (typeof offUpdates === 'function') offUpdates();
		};
	}, [refreshKey, refresh]);

	const serviceForUpdateModal = useMemo(
		() => (imageUpdateServiceId ? services.find((s) => s?.id === imageUpdateServiceId) ?? null : null),
		[services, imageUpdateServiceId]
	);

	const servicesWithHandlers = useMemo(
		() =>
			services.map((s) => ({
				...s,
				imageUpdate: {
					...(s.imageUpdate as object || {}),
					onOpenDetails: (serviceId?: string) => setImageUpdateServiceId(serviceId || null),
				},
			})),
		[services]
	);

	if (loading) {
		return <div className="main-panel-loading">Loading Swarm services...</div>;
	}

	return (
		<>
			<OverviewTableWithPanel
				title={swarmServiceConfig.title ?? ''}
				columns={swarmServiceConfig.columns}
				data={servicesWithHandlers}
				tabs={swarmServiceConfig.tabs}
				tabCountsFetcher={swarmServiceConfig.tabCountsFetcher as (_row: ResourceRow) => Promise<Record<string, number>>}
				renderPanelContent={(row, tab, panelApi) =>
					swarmServiceConfig.renderPanelContent?.(row, tab, state, analyze, cancel, withRefresh(panelApi), services)
				}
				createPlatform={swarmServiceConfig.createPlatform as 'swarm' | 'k8s'}
				createKind={swarmServiceConfig.createKind}
				tableTestId={swarmServiceConfig.tableTestId}
				getRowActions={(row, api) => {
					const originalActions = swarmServiceConfig.getRowActions?.(row, withRefresh(api), helpers) ?? [];
					return originalActions.map((action) => {
						if (action.label === 'Scale…' && typeof action.onClick === 'function') {
							return {
								...action,
								onClick: () => {
									setScaleValue(String(row?.replicas ?? 0));
									setPendingAction({ type: 'scale', row });
								},
							};
						}
						if (action.label === 'Delete' && typeof action.onClick === 'function') {
							return {
								...action,
								onClick: () => {
									setPendingAction({ type: 'delete', row });
								},
							};
						}
						return action;
					});
				}}
				headerActions={
					<button
						id="swarm-image-update-settings-btn"
						type="button"
						onClick={() => setImageUpdateSettingsOpen(true)}
						style={{
							padding: '6px 10px',
							borderRadius: 4,
							border: '1px solid var(--gh-border, #30363d)',
							backgroundColor: 'var(--gh-button-bg, #21262d)',
							color: 'var(--gh-text, #c9d1d9)',
							cursor: 'pointer',
							fontSize: 12,
							fontWeight: 500,
							marginRight: 8,
						}}
						title="Image update detection settings"
					>
						Image Updates
					</button>
				}
			/>

			<ImageUpdateModal
				open={Boolean(imageUpdateServiceId)}
				service={serviceForUpdateModal}
				onClose={() => setImageUpdateServiceId(null)}
			/>

			<ImageUpdateSettingsModal
				open={imageUpdateSettingsOpen}
				onClose={() => setImageUpdateSettingsOpen(false)}
			/>

			{/* Scale modal */}
			<BaseModal
				isOpen={pendingAction?.type === 'scale'}
				onClose={() => {
					setPendingAction(null);
					setScaleValue('');
				}}
				title="Scale service"
			>
				<div className="modal-content">
					<div className="form-group">
						<label htmlFor="service-scale-input">Enter desired replica count:</label>
						<input
							id="service-scale-input"
							data-testid="service-scale-input"
							ref={scaleInputRef}
							type="number"
							min="0"
							value={scaleValue}
							onChange={(e) => setScaleValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleScaleConfirm();
								}
							}}
							autoFocus
						/>
					</div>
					<div className="modal-footer">
						<ModalButton onClick={() => {
							setPendingAction(null);
							setScaleValue('');
						}}>Cancel</ModalButton>
						<ModalPrimaryButton onClick={handleScaleConfirm}>Scale</ModalPrimaryButton>
					</div>
				</div>
			</BaseModal>

			{/* Delete modal */}
			<BaseModal
				isOpen={pendingAction?.type === 'delete'}
				onClose={() => setPendingAction(null)}
				title="Confirm delete"
			>
				<div className="modal-content">
					<p>Are you sure you want to delete service "{pendingAction?.row?.name}"?</p>
					<div className="modal-footer">
						<ModalButton onClick={() => setPendingAction(null)}>Cancel</ModalButton>
						<ModalDangerButton onClick={handleDeleteConfirm}>Delete</ModalDangerButton>
					</div>
				</div>
			</BaseModal>
		</>
	);
}
