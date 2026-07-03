import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmConfigConfig } from '../../../config/resourceConfigs/swarm/configConfig';

export default function SwarmConfigsOverviewTable() {
	const [configs, setConfigs] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let active = true;

		const loadConfigs = async () => {
			try {
				const data = await swarmConfigConfig.fetchFn?.();
				if (active) {
					setConfigs(Array.isArray(data) ? data : []);
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

		loadConfigs();

		const off = EventsOn(swarmConfigConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setConfigs(data);
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
			title={swarmConfigConfig.title}
			columns={swarmConfigConfig.columns}
			data={configs}
			tabs={swarmConfigConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmConfigConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, panelApi)
			}
			createPlatform={swarmConfigConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmConfigConfig.createKind}
			tableTestId={swarmConfigConfig.tableTestId}
			getRowActions={(row, api) => swarmConfigConfig.getRowActions?.(row, api) ?? []}
		/>
	);
}
