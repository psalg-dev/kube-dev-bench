import { useCallback, useEffect, useState } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime';
import OverviewTableWithPanel from '../../../layout/overview/OverviewTableWithPanel';
import { useSwarmState } from '../../SwarmStateContext';
import { swarmSecretConfig } from '../../../config/resourceConfigs/swarm/secretConfig';
import { emptyHolmesHelpers, type PanelApi, type ResourceRow } from '../../../types/resourceConfigs';

export default function SwarmSecretsOverviewTable() {
	const swarm = useSwarmState();
	const connected = swarm?.connected;
	const [secrets, setSecrets] = useState<ResourceRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);

	const refresh = useCallback(() => {
		setRefreshKey((k) => k + 1);
	}, []);

	const withRefresh = useCallback((api?: PanelApi): PanelApi => ({ ...(api ?? {}), refresh }), [refresh]);

	useEffect(() => {
		let active = true;

		const loadSecrets = async () => {
			if (!connected) {
				if (active) {
					setSecrets([]);
					setLoading(false);
				}
				return;
			}
			if (active) {
				setLoading(true);
			}
			try {
				const data = await swarmSecretConfig.fetchFn?.();
				if (active) {
					setSecrets((Array.isArray(data) ? data : []) as ResourceRow[]);
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load secrets:', err);
				if (active) {
					setSecrets([]);
					setLoading(false);
				}
			}
		};

		loadSecrets();

		if (!connected) {
			return () => {
				active = false;
			};
		}

		const off = EventsOn(swarmSecretConfig.eventName, (data) => {
			if (!active) return;
			if (Array.isArray(data)) {
				setSecrets(data as ResourceRow[]);
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
		return <div className="main-panel-loading">Loading Swarm secrets...</div>;
	}

	return (
		<OverviewTableWithPanel
			title={swarmSecretConfig.title ?? ''}
			columns={swarmSecretConfig.columns}
			data={secrets}
			tabs={swarmSecretConfig.tabs}
			renderPanelContent={(row, tab, panelApi) =>
				swarmSecretConfig.renderPanelContent?.(row, tab, {}, undefined, undefined, withRefresh(panelApi))
			}
			createPlatform={swarmSecretConfig.createPlatform as 'swarm' | 'k8s'}
			createKind={swarmSecretConfig.createKind}
			tableTestId={swarmSecretConfig.tableTestId}
			getRowActions={(row, api) => swarmSecretConfig.getRowActions?.(row, withRefresh(api), emptyHolmesHelpers) ?? []}
		/>
	);
}

