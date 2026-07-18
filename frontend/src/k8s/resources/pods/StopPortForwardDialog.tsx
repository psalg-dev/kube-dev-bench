import { useState } from 'react';

type StopPortForwardDialogProps = {
	open: boolean;
	defaultPort?: number;
	onCancel?: () => void;
	onConfirm?: (port: number) => void;
};

export default function StopPortForwardDialog({ open, defaultPort = 20000, onCancel, onConfirm }: StopPortForwardDialogProps) {
	const [port, setPort] = useState(String(defaultPort));
	const [error, setError] = useState('');

	if (!open) return null;

	const handleSubmit = () => {
		const p = parseInt(port.trim(), 10);
		if (!Number.isFinite(p) || p <= 0 || p > 65535) {
			setError('Invalid port number');
			return;
		}
		setError('');
		onConfirm?.(p);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	};

	return (
		<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
			<div style={{ width: 400, background: 'var(--gh-table-header-bg, #2d323b)', border: '1px solid #353a42', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', color: '#fff' }} onClick={(e) => e.stopPropagation()}>
				<div style={{ padding: '12px 16px', borderBottom: '1px solid #353a42', fontWeight: 600 }}>Stop Port Forward</div>
				<div style={{ padding: 16, display: 'grid', gap: 12 }}>
					<label style={{ display: 'grid', gap: 6 }}>
						<span style={{ color: '#bbb', fontSize: 13 }}>Local port to stop:</span>
						<input
							type="number"
							min="1"
							max="65535"
							value={port}
							onChange={(e) => setPort(e.target.value)}
							onKeyDown={handleKeyDown}
							style={{ padding: '8px 10px', background: '#23272e', border: '1px solid #353a42', color: '#fff', borderRadius: 0 }}
						/>
					</label>
					{error && <div style={{ color: '#d73a49', fontSize: 13 }}>{error}</div>}
				</div>
				<div style={{ padding: 12, borderTop: '1px solid #353a42', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
					<button onClick={onCancel} style={{ padding: '8px 12px', background: '#444c56', color: '#fff', border: '1px solid #353a42', borderRadius: 0, cursor: 'pointer' }}>Cancel</button>
					<button onClick={handleSubmit} style={{ padding: '8px 12px', background: '#d73a49', color: '#fff', border: '1px solid #353a42', borderRadius: 0, cursor: 'pointer' }}>Stop</button>
				</div>
			</div>
		</div>
	);
}
