import SummaryTabHeader from '../../../layout/bottompanel/SummaryTabHeader';
import QuickInfoSection from '../../../QuickInfoSection';

type SecretSummaryPanelProps = {
	row?: {
		name?: string;
		labels?: Record<string, string>;
		dataSize?: number;
		createdAt?: string;
		updatedAt?: string;
	} | null;
};

const quickInfoFields: Array<{ key: string; label: string; type?: 'break-word' | 'date' }> = [
	{ key: 'name', label: 'Name', type: 'break-word' },
	{ key: 'dataSize', label: 'Size' },
	{ key: 'createdAt', label: 'Created', type: 'date' },
	{ key: 'updatedAt', label: 'Updated', type: 'date' },
];

function SecretSummaryPanel({ row }: SecretSummaryPanelProps) {
	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<SummaryTabHeader
				name={row?.name}
				labels={row?.labels}
			/>
			<div style={{ display: 'flex', flex: 1, minHeight: 0, color: 'var(--gh-text, #c9d1d9)' }}>
				<QuickInfoSection
					resourceName={row?.name}
					data={row ?? undefined}
					loading={false}
					error={null}
					fields={quickInfoFields}
				/>
				<div style={{ flex: 1 }} />
			</div>
		</div>
	);
}

export default SecretSummaryPanel;
export { SecretSummaryPanel };
