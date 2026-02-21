import { useMemo, useState, type CSSProperties } from 'react';
import { EventsEmit } from '../../../../wailsjs/runtime/runtime.js';
import { showError, showSuccess } from '../../../notification';
import { CloneSwarmSecret } from '../../swarmApi';

type SecretCloneModalProps = {
	open: boolean;
	sourceId?: string;
	sourceName?: string;
	onClose?: () => void;
	onCreated?: (_name: string) => void;
};
export default function SecretCloneModal({ open, sourceId, sourceName, onClose, onCreated }: SecretCloneModalProps) {
	const [name, setName] = useState('');
	const [value, setValue] = useState('');
	const [masked, setMasked] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const canSave = useMemo(() => {
		return String(name || '').trim().length > 0 && String(value || '').trim().length > 0;
	}, [name, value]);

	const handleClose = () => {
		if (saving) return;
		setError('');
		onClose?.();
	};

	const handleCreate = async () => {
		if (!sourceId) {
			setError('Source secret ID is missing.');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const newName = String(name || '').trim();
			const content = String(value || '');
			await CloneSwarmSecret(sourceId, newName, content);
			showSuccess(`Secret cloned: created "${newName}"`);
			try { EventsEmit('swarm:secrets:update', null); } catch {}
			onCreated?.(newName);
			onClose?.();
			setName('');
			setValue('');
			setMasked(true);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			showError(`Failed to clone secret: ${msg}`);
			setError(msg);
		} finally {
			setSaving(false);
		}
	};

	if (!open) return null;

	const overlayStyle: CSSProperties = {
		position: 'fixed',
		inset: 0,
		backgroundColor: 'rgba(0,0,0,0.6)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1200,
	};

	const modalStyle: CSSProperties = {
		backgroundColor: 'var(--gh-bg, #0d1117)',
		borderRadius: 8,
		padding: 20,
		width: 720,
		maxWidth: 'calc(100vw - 48px)',
		maxHeight: 'calc(100vh - 48px)',
		overflow: 'hidden',
		border: '1px solid var(--gh-border, #30363d)',
		display: 'flex',
		flexDirection: 'column',
		gap: 12,
	};

	const buttonStyle: CSSProperties = {
		padding: '6px 12px',
		borderRadius: 4,
		border: '1px solid var(--gh-border, #30363d)',
		backgroundColor: 'var(--gh-button-bg, #21262d)',
		color: 'var(--gh-text, #c9d1d9)',
		cursor: 'pointer',
		fontSize: 12,
		fontWeight: 500,
	};

	const textAreaStyle: CSSProperties & { WebkitTextSecurity?: 'disc' | 'none' } = {
		width: '100%',
		minHeight: 220,
		resize: 'none',
		padding: 12,
		backgroundColor: 'var(--gh-input-bg, #0d1117)',
		border: '1px solid var(--gh-border, #30363d)',
		borderRadius: 6,
		color: 'var(--gh-text, #c9d1d9)',
		fontSize: 13,
		fontFamily: 'monospace',
		outline: 'none',
		WebkitTextSecurity: masked ? 'disc' : 'none',
	};

	return (
		<div style={overlayStyle} onClick={handleClose}>
			<div className="base-modal-container" style={modalStyle} onClick={(e) => e.stopPropagation()}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
					<div style={{ fontWeight: 600, color: 'var(--gh-text, #c9d1d9)' }}>
						Clone Swarm secret: {sourceName}
					</div>
					<button id="swarm-secret-clone-close-btn" style={buttonStyle} onClick={handleClose} disabled={saving}>
						Close
					</button>
				</div>

				<div style={{ color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12, lineHeight: 1.4 }}>
					Secret values cannot be read back from Swarm. Enter the value you want for the cloned secret.
				</div>

				{error ? <div style={{ color: '#f85149', fontSize: 12 }}>{error}</div> : null}

				<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
					<div>
						<label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-secondary)', fontSize: 12 }}>
							New secret name
						</label>
						<input
							id="swarm-secret-clone-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="secret-name@..."
							disabled={saving}
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
					</div>

					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<div style={{ color: 'var(--gh-text, #c9d1d9)', fontSize: 12, fontWeight: 600 }}>
							Value
						</div>
						<button id="swarm-secret-clone-toggle-mask" style={buttonStyle} onClick={() => setMasked(m => !m)} disabled={saving}>
							{masked ? 'Show' : 'Hide'}
						</button>
					</div>

					<textarea
						id="swarm-secret-clone-value"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						spellCheck={false}
						disabled={saving}
						placeholder="Enter secret value…"
						style={textAreaStyle}
					/>
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
					<button id="swarm-secret-clone-cancel-btn" style={buttonStyle} onClick={handleClose} disabled={saving}>
						Cancel
					</button>
					<button
						id="swarm-secret-clone-create-btn"
						style={{ ...buttonStyle, backgroundColor: '#238636', color: '#fff', borderColor: '#238636' }}
						onClick={handleCreate}
						disabled={saving || !canSave}
					>
						{saving ? 'Creating…' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	);
}

