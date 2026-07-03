import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { swarmTaskConfig } from '../../../config/resourceConfigs/swarm/taskConfig';
import type { HolmesHelpers, PanelApi, ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmTasksOverviewTable() {
	const [tasks, setTasks] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const { state, analyze, cancel } = useHolmesAnalysis({
		kind: swarmTaskConfig.resourceKind,
		analyzeFn: swarmTaskConfig.analyzeFn as (..._args: string[]) => Promise<void>,
		keyPrefix: swarmTaskConfig.holmesKeyPrefix,
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
				const data = await swarmTaskConfig.fetchFn?.();
				if (active) {
					setTasks((Array.isArray(data) ? data : []) as ResourceRow[]);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load tasks:', err);
				if (active) {
					setTasks([]);
					setLoading(false);
				}
			}
		};

		load();

		const off = EventsOn(swarmTaskConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setTasks(data as ResourceRow[]);
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
		return <div className="main-panel-loading">Loading Swarm tasks...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmTaskConfig.title ?? ''}
			columns={swarmTaskConfig.columns}
			data={tasks}
			tabs={swarmTaskConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmTaskConfig.renderPanelContent?.(row, tab, state, analyze, cancel, withRefresh(panelApi), tasks)
			}
			createPlatform={swarmTaskConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmTaskConfig.createKind}
			tableTestId={swarmTaskConfig.tableTestId}
			getRowActions={(row, api) => swarmTaskConfig.getRowActions?.(row, withRefresh(api), helpers) ?? []}
		/>
	);
}
