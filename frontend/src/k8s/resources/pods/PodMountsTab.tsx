import { Fragment, useEffect, useMemo, useState } from 'react';

type PodMountsTabProps = {
	podName: string;
};

export default function PodMountsTab({ podName }: PodMountsTabProps) {
	const [data, setData] = useState<any | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Track expanded volume rows by volume name
	const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
	// Cache loaded secret data per secret name
	const [secretsData, setSecretsData] = useState<Record<string, any>>({}); // { [secretName]: { data: {k: base64}, loading: bool, error: string|null } }
	// Track per-key input value and decode state
	const [secretInputs, setSecretInputs] = useState<Record<string, Record<string, string>>>({}); // { [secretName]: { [key]: string } }
	const [secretDecoded, setSecretDecoded] = useState<Record<string, Record<string, boolean>>>({}); // { [secretName]: { [key]: boolean } }

	const load = async () => {
		if (!podName) return;
		setLoading(true);
		setError(null);
		try {
			const fn = (window as any)?.go?.main?.App?.GetPodMounts;
			if (typeof fn !== 'function') {
				throw new Error('GetPodMounts API not available. Please rebuild backend bindings.');
			}
			const res = await fn(podName);
			setData(res || { volumes: [], containers: [] });
		} catch (e) {
			setError(String((e as Error)?.message || e));
		} finally {
			setLoading(false);
		}
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { load(); }, [podName]);

	const secretsSet = useMemo(() => {
		const set = new Set<string>();
		if (!data || !Array.isArray(data.volumes)) return set;
		for (const v of data.volumes) {
			if (!v) continue;
			const t = String(v.type || v.Type || '').toLowerCase();
			if (t === 'secret') set.add(v.name || v.Name);
			if (t === 'projected') {
				const arr = (v.projectedSecretNames || v.ProjectedSecretNames) || [];
				for (const s of arr) set.add(String(s));
			}
		}
		return set;
	}, [data]);

	const isSecretVolume = (v: any) => {
		if (!v) return false;
		const t = String(v.type || v.Type || '').toLowerCase();
		if (t === 'secret') return true;
		if (t === 'projected') {
			const arr = (v.projectedSecretNames || v.ProjectedSecretNames) || [];
			return Array.isArray(arr) && arr.length > 0;
		}
		return false;
	};

	const getVolumeSecretNames = (v: any) => {
		const t = String(v?.type || v?.Type || '').toLowerCase();
		if (t === 'secret') {
			return [v?.secretName || v?.SecretName].filter(Boolean);
		}
		if (t === 'projected') {
			const arr = (v?.projectedSecretNames || v?.ProjectedSecretNames) || [];
			return Array.isArray(arr) ? arr.filter(Boolean) : [];
		}
		return [];
	};

	const toggleExpand = async (volKey: string, v: any) => {
		setExpandedRows(prev => {
			const next = new Set(prev);
			if (next.has(volKey)) next.delete(volKey); else next.add(volKey);
			return next;
		});
		// If expanding, kick off loads for secrets in this volume
		const secretNames = getVolumeSecretNames(v);
		for (const sn of secretNames) {
			await ensureSecretLoaded(sn);
		}
	};

	const ensureSecretLoaded = async (secretName: string) => {
		if (!secretName) return;
		const cur = secretsData[secretName];
		if (cur && (cur.loading || cur.data)) return; // already loading/loaded
		setSecretsData(s => ({ ...s, [secretName]: { ...(s[secretName] || {}), loading: true, error: null } }));
		try {
			const fn = (window as any)?.go?.main?.App?.GetSecretData;
			if (typeof fn !== 'function') throw new Error('GetSecretData API not available. Please rebuild backend bindings.');
			const res = await fn(secretName);
			const dataObj = res || {};
			setSecretsData(s => ({ ...s, [secretName]: { data: dataObj, loading: false, error: null } }));
			// prime input/decoded state
			setSecretInputs(prev => ({ ...prev, [secretName]: { ...(prev[secretName] || {}), ...dataObj } }));
			const decodedInit: Record<string, boolean> = {};
			for (const k of Object.keys(dataObj)) decodedInit[k] = false;
			setSecretDecoded(prev => ({ ...prev, [secretName]: { ...(prev[secretName] || {}), ...decodedInit } }));
		} catch (e) {
			setSecretsData(s => ({ ...s, [secretName]: { data: null, loading: false, error: String((e as Error)?.message || e) } }));
		}
	};

	const decodeBase64ToUtf8 = (b64: string) => {
		try {
			// Decode base64 -> bytes
			const binary = atob(b64);
			const len = binary.length;
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
			const td = new TextDecoder('utf-8', { fatal: false });
			return td.decode(bytes);
		} catch (_e) {
			// Fallback: return original
			return b64;
		}
	};

	const onDecodeClick = (secretName: string, key: string) => {
		setSecretInputs(prev => {
			const val = prev?.[secretName]?.[key] ?? '';
			const decoded = decodeBase64ToUtf8(val);
			return { ...prev, [secretName]: { ...(prev[secretName] || {}), [key]: decoded } };
		});
		setSecretDecoded(prev => ({ ...prev, [secretName]: { ...(prev[secretName] || {}), [key]: true } }));
	};

	const onInputChange = (secretName: string, key: string, value: string) => {
		setSecretInputs(prev => ({ ...prev, [secretName]: { ...(prev[secretName] || {}), [key]: value } }));
	};

	return (
		<div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
			<div style={{ padding: '8px 10px', borderBottom: '1px solid var(--gh-border, #30363d)', background: 'var(--gh-bg-sidebar, #161b22)', color: 'var(--gh-text, #c9d1d9)' }}>
				Mounts for {podName}
			</div>
			{loading && <div style={{ padding: 12, color: 'var(--gh-text-muted, #8b949e)' }}>Loading…</div>}
			{error && <div style={{ padding: 12, color: '#f85149' }}>Error: {error}</div>}
			{!loading && !error && (
				<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 0, flex: 1, minHeight: 0 }}>
					{/* Left: Volumes */}
					<div style={{ borderRight: '1px solid var(--gh-border, #30363d)', display: 'flex', flexDirection: 'column', minWidth: 260 }}>
						<div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>Volumes</div>
						<div style={{ padding: 12, overflow: 'auto' }}>
							{Array.isArray(data?.volumes) && data.volumes.length > 0 ? (
								<table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
									<thead>
										<tr>
											<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Name</th>
											<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Type</th>
											<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Source</th>
											<th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #353a42', width: 48 }}>Actions</th>
										</tr>
									</thead>
									<tbody>
										{data.volumes.map((v: any) => {
											const key = String(v?.name || v?.Name || '');
											const type = v?.type || v?.Type || '-';
											const typeLower = String(type).toLowerCase();
											let source = '-';
											if (v?.secretName || v?.SecretName) source = `secret/${v.secretName || v.SecretName}`;
											else if (v?.configMapName || v?.ConfigMapName) source = `configmap/${v.configMapName || v.ConfigMapName}`;
											else if (v?.persistentVolumeClaim || v?.PersistentVolumeClaim) source = `pvc/${v.persistentVolumeClaim || v.PersistentVolumeClaim}`;
											else if (v?.hostPath || v?.HostPath) source = `hostPath:${v.hostPath || v.HostPath}`;
											else if (typeLower === 'emptydir') source = 'emptyDir';
											else if (typeLower === 'projected') {
												const secs = (v.projectedSecretNames || v.ProjectedSecretNames) || [];
												const cms = (v.projectedConfigMapNames || v.ProjectedConfigMapNames) || [];
												const parts: string[] = [];
												if (secs.length) parts.push(`secrets: ${secs.join(', ')}`);
												if (cms.length) parts.push(`configMaps: ${cms.join(', ')}`);
												source = parts.join(' | ') || 'projected';
											}
											const isSecret = isSecretVolume(v);
											const expanded = expandedRows.has(key);
											return (
												<Fragment key={key}>
													<tr>
														<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', textAlign: 'left' }}>
															<span>{key}</span>
															{isSecret && (
																<span style={{ marginLeft: 8, fontSize: 12, color: '#d29922' }} title="Uses secret data">🔒</span>
															)}
														</td>
														<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', textAlign: 'left' }}>{type}</td>
														<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', wordBreak: 'break-all', textAlign: 'left' }}>{source}</td>
														<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', textAlign: 'right' }}>
															{isSecret ? (
																<button onClick={() => toggleExpand(key, v)} style={{ padding: '2px 6px', border: '1px solid #30363d', background: '#21262d', color: '#c9d1d9', cursor: 'pointer' }} title={expanded ? 'Hide' : 'Show secrets'}>...</button>
															) : null}
														</td>
													</tr>
													{expanded && (
														<tr>
															<td colSpan={4} style={{ padding: 0, background: 'var(--gh-bg-canvas, #0d1117)', borderBottom: '1px solid #353a42' }}>
																<div style={{ padding: '10px 10px 12px 10px' }}>
																	{(() => {
																		const names = getVolumeSecretNames(v);
																		if (!names.length) {
																			return <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No secret names found for this volume.</div>;
																		}
																		return (
																			<div style={{ display: 'grid', gap: 12 }}>
																				{names.map((sn: string) => {
																					const entry = secretsData[sn] || { loading: false, error: null, data: null };
																					return (
																						<div key={sn} style={{ border: '1px solid #30363d', background: '#0b121a' }}>
																							<div style={{ padding: '6px 8px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 8 }}>
																								<span style={{ fontWeight: 600 }}>secret/{sn}</span>
																								{entry.loading && <span style={{ color: 'var(--gh-text-muted, #8b949e)' }}>Loading…</span>}
																								{entry.error && <span style={{ color: '#f85149' }}>Error: {entry.error}</span>}
																							</div>
																							<div style={{ padding: 8 }}>
																								{entry.data && Object.keys(entry.data).length > 0 ? (
																									<table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
																										<thead>
																											<tr>
																												<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42', width: 220 }}>Key</th>
																												<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Value</th>
																											</tr>
																										</thead>
																										<tbody>
																											{Object.keys(entry.data).sort().map((k) => {
																												const val = secretInputs?.[sn]?.[k] ?? '';
																												const dec = !!(secretDecoded?.[sn]?.[k]);
																												return (
																													<tr key={`${sn}|${k}`}>
																														<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', verticalAlign: 'top' }}>{k}</td>
																														<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42' }}>
																															<div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
																																<input value={val} onChange={(e) => onInputChange(sn, k, e.target.value)} style={{ flex: 1, minWidth: 0, background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', padding: '4px 6px' }} />
																																<button onClick={() => onDecodeClick(sn, k)} disabled={dec} style={{ padding: '4px 8px', border: '1px solid #30363d', background: dec ? '#1f6feb22' : '#21262d', color: '#c9d1d9', cursor: dec ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>{dec ? 'Decoded' : 'Decode'}</button>
																															</div>
																														</td>
																													</tr>
																												);
																											})}
																										</tbody>
																									</table>
																								) : (
																									!entry.loading && !entry.error && <div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No data.</div>
																								)}
																							</div>
																						</div>
																					);
																				})}
																			</div>
																		);
																	})()}
																</div>
															</td>
														</tr>
													)}
												</Fragment>
											);
										})}
									</tbody>
								</table>
							) : (
								<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No volumes.</div>
							)}
						</div>
					</div>

					{/* Right: Mounts per container */}
					<div style={{ display: 'flex', flexDirection: 'column', minWidth: 320 }}>
						<div style={{ height: 44, padding: '0 12px', borderBottom: '1px solid var(--gh-border, #30363d)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>Container mounts</div>
						<div style={{ padding: 12, overflow: 'auto' }}>
							{Array.isArray(data?.containers) && data.containers.length > 0 ? (
								<div style={{ display: 'grid', gap: 12 }}>
									{data.containers.map((c: any, idx: number) => {
										const name = c?.container || c?.Container || `c${idx}`;
										const isInit = !!(c?.isInit ?? c?.IsInit);
										const mounts = Array.isArray(c?.mounts || c?.Mounts) ? (c.mounts || c.Mounts) : [];
										return (
											<div key={`${name}|${idx}`} style={{ border: '1px solid #353a42', background: 'var(--gh-bg-canvas, #0d1117)' }}>
												<div style={{ padding: '8px 10px', borderBottom: '1px solid #353a42', display: 'flex', alignItems: 'center', gap: 8 }}>
													<span style={{ fontWeight: 600 }}>{name}</span>
													{isInit && <span style={{ fontSize: 12, color: '#8b949e' }}>(init)</span>}
												</div>
												<div style={{ padding: 10 }}>
													{mounts.length > 0 ? (
														<table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
															<thead>
																<tr>
																	<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Volume</th>
																	<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Mount path</th>
																	<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>Mode</th>
																	<th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #353a42' }}>SubPath</th>
																</tr>
															</thead>
															<tbody>
																{mounts.map((m: any, i: number) => {
																	const volName = String(m?.name || m?.Name || `v${i}`);
																	const mountPath = m?.mountPath || m?.MountPath || '-';
																	const ro = !!(m?.readOnly ?? m?.ReadOnly);
																	const subPath = m?.subPath || m?.SubPath || '';
																	const secretMark = secretsSet.has(volName);
																	return (
																		<tr key={`${volName}|${mountPath}|${i}`}>
																			<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', textAlign: 'left' }}>
																				<span>{volName}</span>
																				{secretMark && <span style={{ marginLeft: 6 }} title="Secret volume">🔒</span>}
																			</td>
																			<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', wordBreak: 'break-all', textAlign: 'left' }}>{mountPath}</td>
																			<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', textAlign: 'left' }}>
																				<span style={{ background: ro ? 'rgba(187,128,9,0.12)' : 'rgba(46,160,67,0.15)', color: ro ? '#d29922' : '#3fb950', border: '1px solid #303d42', padding: '2px 6px' }}>
																					{ro ? 'ro' : 'rw'}
																				</span>
																			</td>
																			<td style={{ padding: '6px 8px', borderBottom: '1px solid #353a42', textAlign: 'left' }}>{subPath || '-'}</td>
																		</tr>
																	);
																})}
															</tbody>
														</table>
													) : (
														<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No mounts.</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div style={{ color: 'var(--gh-text-muted, #8b949e)' }}>No containers.</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}