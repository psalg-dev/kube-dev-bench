import { useEffect, useState } from 'react';
import TextViewerTab from '../../../layout/bottompanel/TextViewerTab';
import { GetSwarmConfigData } from '../../swarmApi';

function extractTemplateVariables(text: string): string[] {
	const s = String(text || '');
	const re = /\{\{\s*([^}]+?)\s*\}\}/g;
	const found = new Set<string>();
	let m;
	while ((m = re.exec(s)) !== null) {
		const v = String(m[1] || '').trim();
		if (v) found.add(v);
		if (found.size > 50) break;
	}
	return Array.from(found);
}

type ConfigDataTabProps = {
	configId?: string;
	configName?: string;
};

function ConfigDataTab({ configId, configName }: ConfigDataTabProps) {
	const [data, setData] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		let active = true;

		const loadData = async () => {
			if (!configId) {
				if (active) {
					setData('');
					setError('Missing config id.');
					setLoading(false);
				}
				return;
			}
			if (active) {
				setLoading(true);
				setError('');
			}
			try {
				const content = await GetSwarmConfigData(configId);
				if (active) {
					setData(content || '');
					setLoading(false);
				}
			} catch (err) {
				console.error('Failed to load config data:', err);
				if (active) {
					const message = err instanceof Error ? err.message : String(err);
					setError(message);
					setLoading(false);
				}
			}
		};

		loadData();

		return () => {
			active = false;
		};
	}, [configId]);

	if (loading) {
		return (
			<div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
				Loading config data...
			</div>
		);
	}

	if (error) {
		return (
			<div style={{ padding: 32, textAlign: 'center', color: '#f85149' }}>
				Failed to load config data: {error}
			</div>
		);
	}

	const templateVars = extractTemplateVariables(data);

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
			{templateVars.length > 0 ? (
				<div
					style={{
						padding: 10,
						border: '1px solid var(--gh-border, #30363d)',
						borderRadius: 6,
						backgroundColor: 'var(--gh-input-bg, #0d1117)',
						color: 'var(--gh-text-secondary, #8b949e)',
						fontSize: 12,
						lineHeight: 1.4,
					}}
				>
					<div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)', marginBottom: 6 }}>
						Detected template variables
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
						{templateVars.map((v) => (
							<span key={v} style={{ border: '1px solid var(--gh-border, #30363d)', borderRadius: 999, padding: '2px 8px' }}>
								{v}
							</span>
						))}
					</div>
				</div>
			) : null}

			<div style={{ flex: 1, minHeight: 0, border: '1px solid var(--gh-border, #30363d)', borderRadius: 6, overflow: 'hidden' }}>
				<TextViewerTab
					content={data || '(empty)'}
					loading={false}
					error={null}
					filename={configName}
				/>
			</div>
		</div>
	);
}

export default ConfigDataTab;
export { ConfigDataTab };

