import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection, { type QuickInfoField } from '../../../QuickInfoSection';
import type { docker } from '../../../../wailsjs/go/models';

const quickInfoFields = [
	{ key: 'name', label: 'Name', type: 'break-word' },
	{ key: 'services', label: 'Services' },
	{ key: 'networks', label: 'Networks' },
	{ key: 'volumes', label: 'Volumes' },
	{ key: 'configs', label: 'Configs' },
	{ key: 'secrets', label: 'Secrets' },
] satisfies QuickInfoField[];

type StackSummaryPanelProps = {
	row: docker.SwarmStackInfo;
};

export default function StackSummaryPanel({ row }: StackSummaryPanelProps) {
	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row?.name}
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

export { StackSummaryPanel };
