import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserOpenURL, EventsOff, EventsOn } from '../../../../wailsjs/runtime';

type PortForwardOutputProps = {
	namespace: string;
	podName: string;
	localPort: number;
	remotePort: number;
};

export default function PortForwardOutput({ namespace, podName, localPort, remotePort }: PortForwardOutputProps) {
	const [ready, setReady] = useState(false);
	const [ended, setEnded] = useState(false);
	const [lines, setLines] = useState<string[]>([]);

	const scrollRef = useRef<HTMLDivElement | null>(null);

	const key = useMemo(() => {
		if (!namespace || !podName || !localPort || !remotePort) return null;
		return `${namespace}/${podName}:${localPort}:${remotePort}`;
	}, [namespace, podName, localPort, remotePort]);

	const url = useMemo(() => (localPort ? `http://127.0.0.1:${localPort}` : ''), [localPort]);

	useEffect(() => {
		const resetTimerId = window.setTimeout(() => {
			setLines([]);
			setReady(false);
			setEnded(false);
		}, 0);

		if (!key) {
			return () => {
				window.clearTimeout(resetTimerId);
			};
		}

		const outputEvent = `portforward:${key}:output`;
		const errorEvent = `portforward:${key}:error`;
		const readyEvent = `portforward:${key}:ready`;
		const exitEvent = `portforward:${key}:exit`;

		const onOutput = (line: string) => setLines(prev => [...prev, String(line)]);
		const onError = (msg: string) => setLines(prev => [...prev, `[error] ${String(msg)}`]);
		const onReady = () => { setReady(true); setLines(prev => [...prev, `[ready] Forwarding ${localPort} -> ${remotePort}`]); };
		const onExit = () => { setEnded(true); setLines(prev => [...prev, '[exit] port-forward ended']); };

		EventsOn(outputEvent, onOutput);
		EventsOn(errorEvent, onError);
		EventsOn(readyEvent, onReady);
		EventsOn(exitEvent, onExit);

		return () => {
			window.clearTimeout(resetTimerId);
			EventsOff(outputEvent, errorEvent, readyEvent, exitEvent);
		};
	}, [key, localPort, remotePort]);

	useEffect(() => {
		// autoscroll to bottom on new lines
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [lines]);

	const handleOpen = () => {
		if (!url) return;
		try { BrowserOpenURL(url); } catch {}
	};

	const handleStop = async () => {
		try {
			const stop = (window as unknown)?.go?.main?.App?.StopPortForward;
			if (typeof stop === 'function') {
				await stop(namespace, podName, localPort);
			}
		} catch {}
	};

	if (!podName) {
		return <div style={{ padding: 12, color: '#bbb' }}>Select a pod to view port-forward output.</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #353a42', background: 'var(--gh-table-header-bg, #2d323b)' }}>
				<span title={ready ? 'Ready' : ended ? 'Ended' : 'Starting...'} style={{ width: 10, height: 10, borderRadius: '50%', background: ended ? '#d73a49' : ready ? '#2ea44f' : '#c9a600', display: 'inline-block' }} />
				<strong style={{ color: '#fff' }}>{podName}</strong>
				<span style={{ color: '#aaa' }}>→</span>
				<span style={{ color: '#aaa' }}>{localPort} → {remotePort}</span>
				<span style={{ color: '#aaa' }}>•</span>
				<a href={url} onClick={(e) => { e.preventDefault(); handleOpen(); }} style={{ color: '#4aa3ff', textDecoration: 'none' }}>{url}</a>
				<div style={{ flex: 1 }} />
				<button onClick={handleOpen} disabled={!ready} style={{ padding: '6px 10px', background: '#2d7ef7', color: '#fff', border: 'none', borderRadius: 0, cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.6 }}>Open</button>
				<button onClick={handleStop} style={{ padding: '6px 10px', background: '#d73a49', color: '#fff', border: 'none', borderRadius: 0, marginLeft: 8, cursor: 'pointer' }}>Stop</button>
			</div>
			<div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: '#11161c', color: '#e0e0e0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12, padding: 12 }}>
				{lines.length === 0 ? (
					<div style={{ color: '#888' }}>Waiting for output...</div>
				) : (
					lines.map((line, idx) => (
						<div key={idx} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{line}</div>
					))
				)}
			</div>
		</div>
	);
}