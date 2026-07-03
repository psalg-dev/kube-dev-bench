import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
import { useHolmesStream } from '../../../hooks/useHolmesStream';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { swarmTaskConfig } from '../../../config/resourceConfigs/swarm/taskConfig';

export default function SwarmTasksOverviewTable() {
	const [tasks, setTasks] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);
	const holmesState = useHolmesStream();

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let active = true;

		const loadTasks = async () => {
			try {
				const data = await swarmTaskConfig.fetchFn?.();
				if (active) {
					setTasks(Array.isArray(data) ? data : []);
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

		loadTasks();

		const off = EventsOn(swarmTaskConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setTasks(data);
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
			title={swarmTaskConfig.title}
			columns={swarmTaskConfig.columns}
			data={tasks}
			tabs={swarmTaskConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmTaskConfig.renderPanelContent?.(row, tab, holmesState.state, holmesState.analyze, holmesState.cancel, panelApi)
			}
			createPlatform={swarmTaskConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmTaskConfig.createKind}
			tableTestId={swarmTaskConfig.tableTestId}
			getRowActions={(row, api) => swarmTaskConfig.getRowActions?.(row, api, { holmesState: holmesState.state, analyze: holmesState.analyze }) ?? []}
		/>
	);
}
