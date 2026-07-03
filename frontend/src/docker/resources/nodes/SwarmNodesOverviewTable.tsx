import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmNodeConfig } from '../../../config/resourceConfigs/swarm/nodeConfig';

export default function SwarmNodesOverviewTable() {
	const [nodes, setNodes] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let active = true;

		const loadNodes = async () => {
			try {
				const data = await swarmNodeConfig.fetchFn?.();
				if (active) {
					setNodes(Array.isArray(data) ? data : []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load nodes:', err);
				if (active) {
					setNodes([]);
					setLoading(false);
				}
			}
		};

		loadNodes();

		const off = EventsOn(swarmNodeConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setNodes(data);
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
		return <div className="main-panel-loading">Loading Swarm nodes...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmNodeConfig.title}
			columns={swarmNodeConfig.columns}
			data={nodes}
			tabs={swarmNodeConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmNodeConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, panelApi)
			}
			createPlatform={swarmNodeConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmNodeConfig.createKind}
			tableTestId={swarmNodeConfig.tableTestId}
			getRowActions={(row, api) => swarmNodeConfig.getRowActions?.(row, api) ?? []}
		/>
	);
}
