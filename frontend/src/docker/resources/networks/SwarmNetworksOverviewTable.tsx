import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmNetworkConfig } from '../../../config/resourceConfigs/swarm/networkConfig';
import { emptyHolmesHelpers, type PanelApi, type ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmNetworksOverviewTable() {
	const [networks, setNetworks] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey(k => k + 1);
	}, []);

	const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

	useEffect(() => {
		let active = true;

		const loadNetworks = async () => {
			try {
				const data = await swarmNetworkConfig.fetchFn?.();
				if (active) {
					setNetworks((Array.isArray(data) ? data : []) as ResourceRow[]);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load networks:', err);
				if (active) {
					setNetworks([]);
					setLoading(false);
				}
			}
		};

		loadNetworks();

		const off = EventsOn(swarmNetworkConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setNetworks(data as ResourceRow[]);
			} else {
				refresh();
			}
		});

		return () => {
			active = false;
			if (typeof off === 'function') off();
		};
	}, [refreshKey, refresh]);

	if (loading) {
		return <div className="main-panel-loading">Loading networks...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmNetworkConfig.title ?? ''}
			columns={swarmNetworkConfig.columns}
			data={networks}
			tabs={swarmNetworkConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmNetworkConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, withRefresh(panelApi))
			}
			tabCountsFetcher={swarmNetworkConfig.tabCountsFetcher as (_row: ResourceRow) => Promise<Record<string, number>>}
			createPlatform={swarmNetworkConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmNetworkConfig.createKind}
			tableTestId={swarmNetworkConfig.tableTestId}
			getRowActions={(row, api) => swarmNetworkConfig.getRowActions?.(row, withRefresh(api), emptyHolmesHelpers) ?? []}
		/>
	);
}

