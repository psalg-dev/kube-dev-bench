import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type UpdateServiceImageModalProps = {
	open: boolean;
	currentImage?: string;
	serviceName?: string;
	onClose?: () => void;
	onConfirm?: (_image: string) => void;
};
export default function UpdateServiceImageModal({ open, currentImage, serviceName, onClose, onConfirm }: UpdateServiceImageModalProps) {
	const [image, setImage] = useState(currentImage || '');
	const normalizeImage = (value: string) => {
		const trimmed = (value || '').trim();
		if (!trimmed) return '';
		const parts = trimmed.split(/\s+/);
		return parts[parts.length - 1] || '';
	};

	useEffect(() => {
		if (!open) return;
		let active = true;
		queueMicrotask(() => {
			if (!active) return;
			setImage(currentImage || '');
		});
		return () => {
			active = false;
		};
	}, [open, currentImage]);

	const canSave = useMemo(() => {
		const normalized = normalizeImage(image || '');
		return normalized.length > 0 && normalized !== normalizeImage(currentImage || '');
	}, [image, currentImage]);

	if (!open) return null;

	const modalOverlayStyle: CSSProperties = {
		position: 'fixed',
		inset: 0,
		backgroundColor: 'rgba(0,0,0,0.6)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1100,
	};

	const modalStyle: CSSProperties = {
		backgroundColor: 'var(--gh-bg, #0d1117)',
		borderRadius: 8,
		padding: 24,
		width: 520,
		boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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

	return (
		<div style={modalOverlayStyle} onClick={onClose}>
			<div style={modalStyle} onClick={(e) => e.stopPropagation()}>
				<h3 style={{ margin: '0 0 16px', color: 'var(--gh-text)' }}>
					Update Service Image: {serviceName}
				</h3>

				<div style={{ marginBottom: 12, color: 'var(--gh-text-secondary, #8b949e)', fontSize: 12 }}>
					This updates the service spec and triggers a redeploy.
				</div>

				<div style={{ marginBottom: 16 }}>
					<label style={{ display: 'block', marginBottom: 6, color: 'var(--gh-text-secondary)' }}>
						Image (including tag)
					</label>
					<input
						id="swarm-service-update-image-input"
						value={image}
						onChange={(e) => setImage(e.target.value)}
						placeholder="repo/image:tag"
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

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
					<button id="swarm-service-update-image-cancel-btn" style={buttonStyle} onClick={onClose}>
						Cancel
					</button>
					<button
						id="swarm-service-update-image-confirm-btn"
						style={{ ...buttonStyle, backgroundColor: '#238636', color: '#fff' }}
						onClick={() => onConfirm?.(normalizeImage(image))}
						disabled={!canSave}
					>
						Update
					</button>
				</div>
			</div>
		</div>
	);
}
