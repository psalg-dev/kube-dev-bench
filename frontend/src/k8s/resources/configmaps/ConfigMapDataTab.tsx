import { useEffect, useState } from 'react';
import * as AppAPI from '../../../../wailsjs/go/main/App';
import { showError, showSuccess } from '../../../notification';
import type { app } from '../../../../wailsjs/go/models';

// Simple syntax detection for common formats
const detectSyntax = (content: string, key: string) => {
	const ext = key.split('.').pop()?.toLowerCase();
	if (ext === 'json' || ext === 'js') return 'json';
	if (ext === 'yaml' || ext === 'yml') return 'yaml';
	if (ext === 'xml') return 'xml';
	if (ext === 'properties' || ext === 'ini' || ext === 'conf') return 'properties';
	if (ext === 'sh' || ext === 'bash') return 'shell';

	// Try to detect from content
	const trimmed = content.trim();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
	if (trimmed.includes(':') && (trimmed.includes('\n  ') || trimmed.includes('\n-'))) return 'yaml';

	return 'text';
};

const getSyntaxColor = (syntax: string) => {
	switch (syntax) {
		case 'json': return '#f1e05a';
		case 'yaml': return '#cb171e';
		case 'xml': return '#e44b23';
		case 'properties': return '#89e051';
		case 'shell': return '#89e051';
		default: return '#8b949e';
	}
};

type ConfigMapDataTabProps = {
	namespace?: string;
	configMapName?: string;
};

export default function ConfigMapDataTab({ namespace, configMapName }: ConfigMapDataTabProps) {
	const [data, setData] = useState<app.ConfigMapDataInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [draftValue, setDraftValue] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!namespace || !configMapName) return;

		setLoading(true);
		setError(null);

		AppAPI.GetConfigMapDataByName(namespace, configMapName)
			.then(result => {
				setData(result || []);
				setLoading(false);
				// Auto-expand first key if only one
				if (result && result.length === 1) {
					setExpandedKeys(new Set([result[0].key]));
				}
			})
			.catch((err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				setError(message || 'Failed to fetch configmap data');
				setLoading(false);
			});
	}, [namespace, configMapName]);

	const toggleExpand = (key: string) => {
		setExpandedKeys(prev => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const beginEdit = (key: string, value: string) => {
		setEditingKey(key);
		setDraftValue(String(value ?? ''));
	};

	const cancelEdit = () => {
		setEditingKey(null);
		setDraftValue('');
		setSaving(false);
	};

	const saveEdit = async () => {
		if (!editingKey || !namespace || !configMapName) return;
		setSaving(true);
		try {
			await AppAPI.UpdateConfigMapDataKey(namespace, configMapName, editingKey, draftValue);
			setData(prev => prev.map(it => (it.key === editingKey ? { ...it, value: draftValue, size: draftValue.length } : it)));
			showSuccess(`ConfigMap '${configMapName}' updated (${editingKey})`);
			cancelEdit();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			showError(`Failed to update ConfigMap '${configMapName}': ${message}`);
			setSaving(false);
		}
	};

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	if (loading) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>Loading...</div>;
	}

	if (error) {
		return <div style={{ padding: 16, color: '#f85149' }}>Error: {error}</div>;
	}

	if (!data || data.length === 0) {
		return <div style={{ padding: 16, color: 'var(--gh-text-muted, #8b949e)' }}>This ConfigMap has no data.</div>;
	}

	return (
		<div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
			<div style={{ marginBottom: 8, color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
				{data.length} key{data.length !== 1 ? 's' : ''}
			</div>
			{data.map((item) => {
				const isExpanded = expandedKeys.has(item.key);
				const syntax = detectSyntax(item.value, item.key);
				const displayValue = item.isBinary
					? `[Binary data - ${formatSize(item.size)}]`
					: item.value;
				const isEditing = editingKey === item.key;
				const canEdit = !item.isBinary;

				return (
					<div key={item.key} style={{ marginBottom: 8, border: '1px solid #30363d', borderRadius: 6 }}>
						<div
							onClick={() => toggleExpand(item.key)}
							style={{
								padding: '10px 12px',
								backgroundColor: '#161b22',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								borderBottom: isExpanded ? '1px solid #30363d' : 'none',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<span style={{ color: 'var(--gh-text-muted, #8b949e)', width: 16 }}>
									{isExpanded ? '▼' : '▶'}
								</span>
								<span style={{ color: 'var(--gh-text, #c9d1d9)', fontWeight: 500 }}>{item.key}</span>
								<span style={{
									fontSize: 11,
									padding: '2px 6px',
									borderRadius: 3,
									backgroundColor: getSyntaxColor(syntax) + '20',
									color: getSyntaxColor(syntax),
									textTransform: 'uppercase',
								}}>
									{syntax}
								</span>
								{item.isBinary && (
									<span style={{
										fontSize: 11,
										padding: '2px 6px',
										borderRadius: 3,
										backgroundColor: '#f8514920',
										color: '#f85149',
									}}>
										binary
									</span>
								)}
							</div>
							<span style={{ color: 'var(--gh-text-muted, #8b949e)', fontSize: 12 }}>
								{formatSize(item.size)}
							</span>
						</div>
						{isExpanded && (
							<div style={{ backgroundColor: '#0d1117' }}>
								<div style={{ padding: '8px 12px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
									{!isEditing && (
										<button
											type="button"
											disabled={!canEdit}
											onClick={() => beginEdit(item.key, item.value)}
											style={{
												padding: '4px 10px',
												fontSize: 12,
												borderRadius: 4,
												border: '1px solid #353a42',
												background: canEdit ? '#1f6feb' : '#2d323b',
												borderColor: canEdit ? '#388bfd' : '#353a42',
												color: '#fff',
												opacity: canEdit ? 1 : 0.6,
												cursor: canEdit ? 'pointer' : 'not-allowed',
											}}
											title={canEdit ? 'Edit this key' : 'Binary keys cannot be edited'}
										>
											Edit
										</button>
									)}
									{isEditing && (
										<>
											<button
												type="button"
												disabled={saving}
												onClick={cancelEdit}
												style={{
													padding: '4px 10px',
													fontSize: 12,
													borderRadius: 4,
													border: '1px solid #353a42',
													background: '#2d323b',
													color: '#fff',
													opacity: saving ? 0.6 : 1,
													cursor: saving ? 'not-allowed' : 'pointer',
												}}
											>
												Cancel
											</button>
											<button
												type="button"
												disabled={saving}
												onClick={saveEdit}
												style={{
													padding: '4px 10px',
													fontSize: 12,
													borderRadius: 4,
													border: '1px solid #353a42',
													background: '#238636',
													borderColor: '#2ea44f',
													color: '#fff',
													opacity: saving ? 0.6 : 1,
													cursor: saving ? 'not-allowed' : 'pointer',
												}}
											>
												{saving ? 'Saving…' : 'Save'}
											</button>
										</>
									)}
								</div>
								{!isEditing ? (
									<pre style={{
										margin: 0,
										padding: 12,
										overflow: 'auto',
										maxHeight: 400,
										fontSize: 12,
										fontFamily: 'monospace',
										color: 'var(--gh-text, #c9d1d9)',
										whiteSpace: 'pre-wrap',
										wordBreak: 'break-all',
									}}>
										{displayValue}
									</pre>
								) : (
									<textarea
										value={draftValue}
										onChange={(e) => setDraftValue(e.target.value)}
										style={{
											width: '100%',
											minHeight: 220,
											maxHeight: 400,
											resize: 'vertical',
											background: '#0d1117',
											color: 'var(--gh-text, #c9d1d9)',
											border: 'none',
											outline: 'none',
											padding: 12,
											fontSize: 12,
											fontFamily: 'monospace',
											boxSizing: 'border-box',
										}}
									/>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

export { ConfigMapDataTab };
