import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../../QuickInfoSection';
import type { QuickInfoField } from '../../../QuickInfoSection';
import type { docker } from '../../../../wailsjs/go/models';


type ConfigSummaryPanelProps = {
	row?: docker.SwarmConfigInfo;
};

const quickInfoFields: QuickInfoField[] = [
	{ key: 'name', label: 'Name', type: 'break-word' },
	{ key: 'dataSize', label: 'Size' },
	{ key: 'createdAt', label: 'Created', type: 'date' },
	{ key: 'updatedAt', label: 'Updated', type: 'date' },
];

function ConfigSummaryPanel({ row }: ConfigSummaryPanelProps) {
	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row?.name}
				labels={row?.labels}
			/>
			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row?.name}
					data={row}
					loading={false}
					error={null}
					fields={quickInfoFields}
				/>
				<div style={{ flex: 1 }} />
			</div>
		</div>
	);
}

export default ConfigSummaryPanel;
export { ConfigSummaryPanel };
