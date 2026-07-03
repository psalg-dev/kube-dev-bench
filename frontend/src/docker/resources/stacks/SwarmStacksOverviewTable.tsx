import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmStackConfig } from '../../../config/resourceConfigs/swarm/stackConfig';

export default function SwarmStacksOverviewTable() {
	const [stacks, setStacks] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let active = true;

		const loadStacks = async () => {
			try {
				const data = await swarmStackConfig.fetchFn?.();
				if (active) {
					setStacks(Array.isArray(data) ? data : []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load stacks:', err);
				if (active) {
					setStacks([]);
					setLoading(false);
				}
			}
		};

		loadStacks();

		const off = EventsOn(swarmStackConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setStacks(data);
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
		return <div className="main-panel-loading">Loading Swarm stacks...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmStackConfig.title}
			columns={swarmStackConfig.columns}
			data={stacks}
			tabs={swarmStackConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmStackConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, panelApi)
			}
			createPlatform={swarmStackConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmStackConfig.createKind}
			tableTestId={swarmStackConfig.tableTestId}
			getRowActions={(row, api) => swarmStackConfig.getRowActions?.(row, api) ?? []}
		/>
	);
}
