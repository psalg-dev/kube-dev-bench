// This tab is intentionally best-effort: PV usage requires storage backend metrics.
type PVCapacityUsageTabProps = {
	pvName?: string;
};

export default function PVCapacityUsageTab({ pvName }: PVCapacityUsageTabProps) {
	return (
		<div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>
			Capacity usage metrics are not available for PV <span style={{ fontFamily: 'monospace' }}>{pvName}</span>.
			<div style={{ marginTop: 8 }}>
				If your cluster exposes volume usage metrics, we can wire them into this tab.
			</div>
		</div>
	);
}