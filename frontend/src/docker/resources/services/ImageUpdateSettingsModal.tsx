import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GetImageUpdateSettings, SetImageUpdateSettings } from '../../swarmApi';
import { showError, showSuccess } from '../../../notification';

type ImageUpdateSettingsModalProps = {
	open: boolean;
	onClose?: () => void;
};

export default function ImageUpdateSettingsModal({ open, onClose }: ImageUpdateSettingsModalProps) {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [enabled, setEnabled] = useState(false);
	const [intervalMinutes, setIntervalMinutes] = useState(5);

	useEffect(() => {
		if (!open) return;
		let active = true;
		setLoading(true);
		(async () => {
			try {
				const s = await GetImageUpdateSettings();
				if (!active) return;
				setEnabled(Boolean(s?.enabled));
				const seconds = Number(s?.intervalSeconds || 300);
				setIntervalMinutes(Math.max(1, Math.round(seconds / 60)));
			} catch (err) {
				showError(`Failed to load image update settings: ${err}`);
			} finally {
				if (active) setLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, [open]);

	const canSave = useMemo(() => {
		const m = Number(intervalMinutes);
		return Number.isFinite(m) && m >= 1;
	}, [intervalMinutes]);

	if (!open) return null;

	const overlay: CSSProperties = {
		position: 'fixed',
		inset: 0,
		backgroundColor: 'rgba(0,0,0,0.6)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1200,
	};

	const modal: CSSProperties = {
		backgroundColor: 'var(--gh-bg, #0d1117)',
		borderRadius: 8,
		padding: 20,
		width: 520,
		boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
		border: '1px solid var(--gh-border, #30363d)',
	};

	const button: CSSProperties = {
		padding: '6px 12px',
		borderRadius: 4,
		border: '1px solid var(--gh-border, #30363d)',
		backgroundColor: 'var(--gh-button-bg, #21262d)',
		color: 'var(--gh-text, #c9d1d9)',
		cursor: 'pointer',
		fontSize: 12,
		fontWeight: 500,
	};

	const save = async () => {
		if (!canSave) return;
		setSaving(true);
		try {
			const minutes = Number(intervalMinutes);
			const intervalSeconds = Math.max(60, Math.round(minutes * 60));
			await SetImageUpdateSettings({ enabled, intervalSeconds });
			showSuccess('Image update settings saved');
			onClose?.();
		} catch (err) {
			showError(`Failed to save image update settings: ${err}`);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div style={overlay} onClick={onClose}>
			<div style={modal} onClick={(e) => e.stopPropagation()}>
				<h3 style={{ margin: 0, color: 'var(--gh-text)' }}>Image Update Detection</h3>
				<div style={{ marginTop: 10, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
					When enabled, KubeDevBench periodically checks registry digests and updates the Services table.
				</div>

				<div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
					<input
						id="swarm-image-update-enabled"
						type="checkbox"
						checked={enabled}
						onChange={(e) => setEnabled(e.target.checked)}
						disabled={loading || saving}
					/>
					<label htmlFor="swarm-image-update-enabled" style={{ color: 'var(--gh-text)' }}>
						Enable auto-check
					</label>
				</div>

				<div style={{ marginTop: 14 }}>
					<label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
						Check interval (minutes)
					</label>
					<input
						id="swarm-image-update-interval"
						type="number"
						min={1}
						step={1}
						value={intervalMinutes}
						onChange={(e) => setIntervalMinutes(Number(e.target.value))}
						disabled={loading || saving}
						style={{
							width: '100%',
							padding: '8px 12px',
							backgroundColor: 'var(--gh-input-bg, #0d1117)',
							border: '1px solid var(--gh-border, #30363d)',
							borderRadius: 6,
							color: 'var(--gh-text)',
							fontSize: 14,
							boxSizing: 'border-box',
						}}
					/>
					<div style={{ marginTop: 6, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
						Minimum enforced by backend. Default is 5 minutes.
					</div>
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
					<button style={button} onClick={onClose} disabled={saving}>Cancel</button>
					<button style={{ ...button, backgroundColor: '#238636', color: '#fff' }} onClick={save} disabled={!canSave || saving}>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}


