import { useEffect, useState } from 'react';
import { GetSwarmVolumeUsage } from '../../swarmApi';
import EmptyTabContent from '../../../components/EmptyTabContent';
import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
import { navigateToResource } from '../../../utils/resourceNavigation';
import type { docker } from '../../../../wailsjs/go/models';

type VolumeUsedBySectionProps = {
	volumeName: string;
};

export default function VolumeUsedBySection({ volumeName }: VolumeUsedBySectionProps) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>('');
	const [services, setServices] = useState<docker.SwarmServiceRef[]>([]);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError('');

		(async () => {
			try {
				const usage = await GetSwarmVolumeUsage(volumeName);
				if (!active) return;
				setServices(Array.isArray(usage) ? usage : []);
			} catch (e) {
				if (!active) return;
				setServices([]);
				const message = e instanceof Error ? e.message : String(e);
				setError(message);
			} finally {
				if (active) setLoading(false);
			}
		})();

		return () => {
			active = false;
		};
	}, [volumeName]);

	const emptyMsg = getEmptyTabMessage('swarm-volume-usedby');

	const handleServiceClick = (svc: docker.SwarmServiceRef) => {
		const serviceName = svc.serviceName || svc.serviceId;
		if (serviceName) {
			navigateToResource({ resource: 'SwarmService', name: serviceName });
		}
	};

	return (
		<div style={{ padding: 16, overflow: 'auto', flex: 1, minWidth: 0 }}>
			<div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 8 }}>
				Used By
			</div>

			{loading ? (
				<div style={{ color: 'var(--gh-text-secondary, #8b949e)' }}>Loading…</div>
			) : null}

			{error ? (
				<div style={{ color: '#f85149' }}>Failed to load usage: {error}</div>
			) : null}

			{!loading && !error ? (
				services.length === 0 ? (
					<EmptyTabContent
						icon={emptyMsg.icon}
						title={emptyMsg.title}
						description={emptyMsg.description}
						tip={emptyMsg.tip}
					/>
				) : (
					<div style={{ display: 'grid', gap: 6 }}>
						{services
							.slice()
							.sort((a, b) => String(a?.serviceName || '').localeCompare(String(b?.serviceName || '')))
							.map((svc) => (
								<div
									key={svc.serviceId || svc.serviceName}
									onClick={() => handleServiceClick(svc)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleServiceClick(svc); }}
									title={`Open service: ${svc.serviceName || svc.serviceId}`}
									style={{
										padding: '6px 8px',
										border: '1px solid var(--gh-border, #30363d)',
										background: 'var(--gh-input-bg, #0d1117)',
										color: 'var(--gh-link, #58a6ff)',
										fontFamily: 'monospace',
										fontSize: 12,
										wordBreak: 'break-word',
										cursor: 'pointer',
										transition: 'background-color 0.15s ease, color 0.15s ease',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = 'var(--gh-hover-bg, rgba(177, 186, 196, 0.12))';
										e.currentTarget.style.textDecoration = 'underline';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'var(--gh-input-bg, #0d1117)';
										e.currentTarget.style.textDecoration = 'none';
									}}
								>
									{svc.serviceName || svc.serviceId}
								</div>
							))}
					</div>
				)
			) : null}
		</div>
	);
}

