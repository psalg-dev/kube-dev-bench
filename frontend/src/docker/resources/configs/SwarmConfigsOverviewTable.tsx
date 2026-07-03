import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmConfigConfig } from '../../../config/resourceConfigs/swarm/configConfig';
import { emptyHolmesHelpers, type PanelApi, type ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmConfigsOverviewTable() {
	const [configs, setConfigs] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

	useEffect(() => {
		let active = true;

		const load = async () => {
			try {
				const data = await swarmConfigConfig.fetchFn?.();
				if (active) {
					setConfigs((Array.isArray(data) ? data : []) as ResourceRow[]);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load configs:', err);
				if (active) {
					setConfigs([]);
					setLoading(false);
				}
			}
		};

		load();

		const off = EventsOn(swarmConfigConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setConfigs(data as ResourceRow[]);
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
		return <div className="main-panel-loading">Loading Swarm configs...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmConfigConfig.title ?? ''}
			columns={swarmConfigConfig.columns}
			data={configs}
			tabs={swarmConfigConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmConfigConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, withRefresh(panelApi), configs)
			}
			createPlatform={swarmConfigConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmConfigConfig.createKind}
			tableTestId={swarmConfigConfig.tableTestId}
			getRowActions={(row, api) => swarmConfigConfig.getRowActions?.(row, withRefresh(api), emptyHolmesHelpers) ?? []}
		/>
	);
}
