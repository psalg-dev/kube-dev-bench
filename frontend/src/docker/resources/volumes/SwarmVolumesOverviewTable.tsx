import { useCallback, useEffect, useState, useRef } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmVolumeConfig } from '../../../config/resourceConfigs/swarm/volumeConfig';
import { BaseModal, ModalButton, ModalDangerButton, ModalPrimaryButton } from '../../../components/BaseModal';
import { showSuccess, showError } from '../../../notification';
import { GetSwarmVolumeUsage, RemoveSwarmVolume, CloneSwarmVolume, RestoreSwarmVolume } from '../../../docker/swarmApi';
import { emptyHolmesHelpers, type PanelApi, type ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmVolumesOverviewTable() {
	const swarm = useSwarmState();
	const connected = swarm?.connected;
	const [volumes, setVolumes] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);
	const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'clone' | 'restore'; row: ResourceRow } | null>(null);
	const [cloneName, setCloneName] = useState('');
	const cloneInputRef = useRef<HTMLInputElement>(null);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const handleDeleteConfirm = useCallback(async () => {
		if (!pendingAction?.row) return;
		const volumeName = pendingAction.row?.name;
		if (!volumeName) {
			showError('Missing volume name');
			setPendingAction(null);
			return;
		}
		try {
			await RemoveSwarmVolume(volumeName, false);
			showSuccess(`Volume "${volumeName}" deleted`);
			setPendingAction(null);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			showError(`Failed to delete volume: ${message}`);
		}
	}, [pendingAction]);

	const handleCloneConfirm = useCallback(async () => {
		if (!pendingAction?.row) return;
		const volumeName = pendingAction.row?.name;
		if (!volumeName) {
			showError('Missing volume name');
			setPendingAction(null);
			setCloneName('');
			return;
		}
		if (!cloneName.trim()) {
			showError('Volume name is required');
			return;
		}
		try {
			await CloneSwarmVolume(volumeName, cloneName.trim());
			showSuccess(`Cloned volume to "${cloneName.trim()}"`);
			setPendingAction(null);
			setCloneName('');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			showError(`Failed to clone volume: ${message}`);
		}
	}, [pendingAction, cloneName]);

	const handleRestoreConfirm = useCallback(async () => {
		if (!pendingAction?.row) return;
		const volumeName = pendingAction.row?.name;
		if (!volumeName) {
			showError('Missing volume name');
			setPendingAction(null);
			return;
		}
		try {
			const selected = await RestoreSwarmVolume(volumeName);
			if (!selected) return;
			showSuccess(`Restored backup into volume "${volumeName}"`);
			setPendingAction(null);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			showError(`Failed to restore volume: ${message}`);
		}
	}, [pendingAction]);

	const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

	useEffect(() => {
		let active = true;

		const loadVolumes = async () => {
			if (!connected) {
				if (active) {
					setVolumes([]);
					setLoading(false);
				}
				return;
			}
			if (active) {
				setLoading(true);
			}
			try {
				const data = await swarmVolumeConfig.fetchFn?.();
				if (active) {
					setVolumes((Array.isArray(data) ? data : []) as ResourceRow[]);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load volumes:', err);
				if (active) {
					setVolumes([]);
					setLoading(false);
				}
			}
		};

		loadVolumes();

		if (!connected) {
			return () => {
				active = false;
			};
		}

		const off = EventsOn(swarmVolumeConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setVolumes(data as ResourceRow[]);
			} else {
				refresh();
			}
		});

		return () => {
			active = false;
			if (typeof off === 'function') off();
		};
	}, [connected, refreshKey, refresh]);

	if (!connected) {
		return (
			<div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
				Not connected to Docker Swarm
			</div>
		);
	}

	if (loading) {
		return <div className="main-panel-loading">Loading Swarm volumes...</div>;
	}

	return (
		<>
			<OverviewTableWithPanel
				title={swarmVolumeConfig.title ?? ''}
				columns={swarmVolumeConfig.columns}
				data={volumes}
				tabs={swarmVolumeConfig.tabs}
				renderPanelContent={(row, tab, panelApi) =>
					swarmVolumeConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, withRefresh(panelApi))
				}
				createPlatform={swarmVolumeConfig.createPlatform as 'swarm' | 'k8s'}
				createKind={swarmVolumeConfig.createKind}
				tableTestId={swarmVolumeConfig.tableTestId}
				getRowActions={(row, api) => {
					const originalActions = swarmVolumeConfig.getRowActions?.(row, withRefresh(api), emptyHolmesHelpers) ?? [];
					return originalActions.map((action) => {
						if (action.label === 'Restore…' && typeof action.onClick === 'function') {
							return {
								...action,
								onClick: () => {
									setPendingAction({ type: 'restore', row });
								},
							};
						}
						if (action.label === 'Clone…' && typeof action.onClick === 'function') {
							return {
								...action,
								onClick: () => {
									setCloneName('');
									setPendingAction({ type: 'clone', row });
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
			/>
			{/* Restore modal */}
			<BaseModal
				isOpen={pendingAction?.type === 'restore'}
				onClose={() => setPendingAction(null)}
				title="Restore volume"
			>
				<div className="modal-content">
					<p>Restore a backup into volume "{pendingAction?.row?.name}"? This may overwrite files.</p>
					<div className="modal-footer">
						<ModalButton onClick={() => setPendingAction(null)}>Cancel</ModalButton>
						<ModalPrimaryButton onClick={() => {
							if (pendingAction?.row) {
								handleRestoreConfirm();
							}
						}}>Restore</ModalPrimaryButton>
					</div>
				</div>
			</BaseModal>

			{/* Clone modal */}
			<BaseModal
				isOpen={pendingAction?.type === 'clone'}
				onClose={() => {
					setPendingAction(null);
					setCloneName('');
				}}
				title="Clone volume"
			>
				<div className="modal-content">
					<div className="form-group">
						<label htmlFor="volume-clone-input">New volume name:</label>
						<input
							id="volume-clone-input"
							data-testid="volume-clone-input"
							ref={cloneInputRef}
							type="text"
							value={cloneName}
							onChange={(e) => setCloneName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleCloneConfirm();
								}
							}}
							autoFocus
						/>
					</div>
					<div className="modal-footer">
						<ModalButton onClick={() => {
							setPendingAction(null);
							setCloneName('');
						}}>Cancel</ModalButton>
						<ModalPrimaryButton onClick={handleCloneConfirm}>Clone</ModalPrimaryButton>
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
					<p>Are you sure you want to delete volume "{pendingAction?.row?.name}"?</p>
					<div className="modal-footer">
						<ModalButton onClick={() => setPendingAction(null)}>Cancel</ModalButton>
						<ModalDangerButton onClick={handleDeleteConfirm}>Delete</ModalDangerButton>
					</div>
				</div>
			</BaseModal>
		</>
	);
}

