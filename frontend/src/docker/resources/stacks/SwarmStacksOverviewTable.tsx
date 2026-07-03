import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { useHolmesAnalysis } from '../../../hooks/useHolmesAnalysis';
import { useSwarmState } from '../../SwarmStateContext';
import { swarmStackConfig } from '../../../config/resourceConfigs/swarm/stackConfig';
import type { HolmesHelpers, PanelApi, ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmStacksOverviewTable() {
	const swarm = useSwarmState();
	const connected = swarm?.connected;
	const [stacks, setStacks] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const { state, analyze, cancel } = useHolmesAnalysis({
		kind: swarmStackConfig.resourceKind,
		analyzeFn: swarmStackConfig.analyzeFn as (..._args: string[]) => Promise<void>,
		keyPrefix: swarmStackConfig.holmesKeyPrefix,
	});
	const helpers: HolmesHelpers = { holmesState: state, analyze, cancel };

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

	useEffect(() => {
		let active = true;

		const load = async () => {
			if (!connected) {
				if (active) {
					setStacks([]);
					setLoading(false);
				}
				return;
			}
			if (active) setLoading(true);
			try {
				const data = await swarmStackConfig.fetchFn?.();
				if (active) {
					setStacks((Array.isArray(data) ? data : []) as ResourceRow[]);
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

		load();

		if (!connected) {
			return () => {
				active = false;
			};
		}

		const off = EventsOn(swarmStackConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setStacks(data as ResourceRow[]);
			} else {
				refresh();
			}
		});

		return () => {
			active = false;
			if (typeof off === 'function') off();
		};
	}, [connected, refreshKey, refresh]);

	if (!connected) {
		return (
			<div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
				Not connected to Docker Swarm
			</div>
		);
	}

	if (loading) {
		return <div className="main-panel-loading">Loading Swarm stacks...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmStackConfig.title ?? ''}
			columns={swarmStackConfig.columns}
			data={stacks}
			tabs={swarmStackConfig.tabs}
			tabCountsFetcher={swarmStackConfig.tabCountsFetcher as (_row: ResourceRow) => Promise<Record<string, number>>}
			renderPanelContent={(row, tab, panelApi) =>
				swarmStackConfig.renderPanelContent?.(row, tab, state, analyze, cancel, withRefresh(panelApi), stacks)
			}
			createPlatform={swarmStackConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmStackConfig.createKind}
			tableTestId={swarmStackConfig.tableTestId}
			getRowActions={(row, api) => swarmStackConfig.getRowActions?.(row, withRefresh(api), helpers) ?? []}
		/>
	);
}
