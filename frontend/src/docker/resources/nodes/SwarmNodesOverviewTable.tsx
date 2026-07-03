import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { swarmNodeConfig } from '../../../config/resourceConfigs/swarm/nodeConfig';
import type { HolmesHelpers, PanelApi, ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmNodesOverviewTable() {
	const [nodes, setNodes] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const { state, analyze, cancel } = useHolmesAnalysis({
		kind: swarmNodeConfig.resourceKind,
		analyzeFn: swarmNodeConfig.analyzeFn as (..._args: string[]) => Promise<void>,
		keyPrefix: swarmNodeConfig.holmesKeyPrefix,
	});
	const helpers: HolmesHelpers = { holmesState: state, analyze, cancel };

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

	useEffect(() => {
		let active = true;

		const load = async () => {
			try {
				const data = await swarmNodeConfig.fetchFn?.();
				if (active) {
					setNodes((Array.isArray(data) ? data : []) as ResourceRow[]);
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

		load();

		const off = EventsOn(swarmNodeConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setNodes(data as ResourceRow[]);
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
			title={swarmNodeConfig.title ?? ''}
			columns={swarmNodeConfig.columns}
			data={nodes}
			tabs={swarmNodeConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmNodeConfig.renderPanelContent?.(row, tab, state, analyze, cancel, withRefresh(panelApi), nodes)
			}
			createPlatform={swarmNodeConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmNodeConfig.createKind}
			tableTestId={swarmNodeConfig.tableTestId}
			getRowActions={(row, api) => swarmNodeConfig.getRowActions?.(row, withRefresh(api), helpers) ?? []}
		/>
	);
}
