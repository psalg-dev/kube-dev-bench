import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { useHolmesStream } from '../../../hooks/useHolmesStream';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmServiceConfig } from '../../../config/resourceConfigs/swarm/serviceConfig';

export default function SwarmServicesOverviewTable() {
	const [services, setServices] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);
	const holmesState = useHolmesStream();

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let active = true;

		const loadServices = async () => {
			try {
				const data = await swarmServiceConfig.fetchFn?.();
				if (active) {
					setServices(Array.isArray(data) ? data : []);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load services:', err);
				if (active) {
					setServices([]);
					setLoading(false);
				}
			}
		};

		loadServices();

		const off = EventsOn(swarmServiceConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setServices(data);
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
		return <div className="main-panel-loading">Loading Swarm services...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmServiceConfig.title}
			columns={swarmServiceConfig.columns}
			data={services}
			tabs={swarmServiceConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmServiceConfig.renderPanelContent?.(row, tab, holmesState.state, holmesState.analyze, holmesState.cancel, panelApi)
			}
			createPlatform={swarmServiceConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmServiceConfig.createKind}
			tableTestId={swarmServiceConfig.tableTestId}
			headerActions={null}
			getRowActions={(row, api) => swarmServiceConfig.getRowActions?.(row, api, { holmesState: holmesState.state, analyze: holmesState.analyze }) ?? []}
		/>
	);
}
