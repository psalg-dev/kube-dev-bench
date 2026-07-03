import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmNetworkConfig } from '../../../config/resourceConfigs/swarm/networkConfig';

export default function SwarmNetworksOverviewTable() {
	const [networks, setNetworks] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey(k => k + 1);
	}, []);

	useEffect(() => {
		let active = true;

		const loadNetworks = async () => {
			try {
				const data = await swarmNetworkConfig.fetchFn?.();
				if (active) {
					setNetworks((data || []) as any[]);
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
				setNetworks(data);
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
			title={swarmNetworkConfig.title}
			columns={swarmNetworkConfig.columns}
			data={networks}
			tabs={swarmNetworkConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmNetworkConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, panelApi)
			}
			tabCountsFetcher={swarmNetworkConfig.tabCountsFetcher}
			createPlatform={swarmNetworkConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmNetworkConfig.createKind}
			tableTestId={swarmNetworkConfig.tableTestId}
			getRowActions={(row, api) => swarmNetworkConfig.getRowActions?.(row, api) ?? []}
		/>
	);
}

