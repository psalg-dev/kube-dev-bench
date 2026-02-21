import type { docker } from '../../../../wailsjs/go/models';

type ServicePlacementTabProps = {
	row?: docker.SwarmServiceInfo | null;
};

export default function ServicePlacementTab({ row }: ServicePlacementTabProps) {
	const placement = row?.placement || {};
	return (
		<div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
			<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
				{JSON.stringify(placement, null, 2)}
			</pre>
		</div>
	);
}
