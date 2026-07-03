import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import { useSwarmState } from '../../SwarmStateContext';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmVolumeConfig } from '../../../config/resourceConfigs/swarm/volumeConfig';
import { emptyHolmesHelpers, type PanelApi, type ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmVolumesOverviewTable() {
	const swarm = useSwarmState();
	const connected = swarm?.connected;
	const [volumes, setVolumes] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

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
			getRowActions={(row, api) => swarmVolumeConfig.getRowActions?.(row, withRefresh(api), emptyHolmesHelpers) ?? []}
		/>
	);
}

