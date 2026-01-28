import { useEffect, useMemo, useState } from 'react';

export default function PortForwardDialog({
  open,
  _namespace,
  podName,
  onCancel,
  onConfirm,
}) {
  const [ports, setPorts] = useState([]);
  const [sourcePort, setSourcePort] = useState(''); // remote
  const [targetPort, setTargetPort] = useState(''); // local
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // generate a random port above 20000
  const randomHighPort = () => 20000 + Math.floor(Math.random() * 30000);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPorts([]);
    setSourcePort('');
    setTargetPort(String(randomHighPort()));
    async function fetchPorts() {
      try {
        setLoading(true);
        const api = window?.go?.main?.App?.GetPodContainerPorts;
        if (typeof api === 'function') {
          const result = await api(podName);
          if (Array.isArray(result) && result.length > 0) {
            setPorts(result);
            setSourcePort(String(result[0]));
          } else {
            setPorts([]);
          }
        }
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchPorts();
  }, [open, podName]);

  const valid = useMemo(() => {
    const s = parseInt(String(sourcePort).trim(), 10);
    const t = parseInt(String(targetPort).trim(), 10);
    return (
      Number.isFinite(s) &&
      s > 0 &&
      s <= 65535 &&
      Number.isFinite(t) &&
      t > 20000 &&
      t <= 65535
    );
  }, [sourcePort, targetPort]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 440,
          background: 'var(--gh-table-header-bg, #2d323b)',
          border: '1px solid #353a42',
          boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
          color: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #353a42',
            fontWeight: 600,
          }}
        >
          Port Forward
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#bbb' }}>
            Pod: <strong style={{ color: '#fff' }}>{podName}</strong>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: '#bbb', fontSize: 13 }}>
                Source port (container)
              </span>
              <input
                type="number"
                min="1"
                max="65535"
                value={sourcePort}
                onChange={(e) => setSourcePort(e.target.value)}
                style={{
                  padding: '8px 10px',
                  background: '#23272e',
                  border: '1px solid #353a42',
                  color: '#fff',
                  borderRadius: 0,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: '#bbb', fontSize: 13 }}>
                Target port (local)
              </span>
              <input
                type="number"
                min="20001"
                max="65535"
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                style={{
                  padding: '8px 10px',
                  background: '#23272e',
                  border: '1px solid #353a42',
                  color: '#fff',
                  borderRadius: 0,
                }}
              />
            </label>
          </div>
          {ports.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: '#bbb', fontSize: 13 }}>
                Detected container ports:
              </span>
              {ports.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSourcePort(String(p))}
                  style={{
                    padding: '4px 8px',
                    background: '#23272e',
                    border: '1px solid #353a42',
                    color: '#fff',
                    borderRadius: 0,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {loading && <div style={{ color: '#aaa' }}>Loading ports…</div>}
          {error && <div style={{ color: '#d73a49' }}>Error: {error}</div>}
        </div>
        <div
          style={{
            padding: 12,
            borderTop: '1px solid #353a42',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 12px',
              background: '#444c56',
              color: '#fff',
              border: '1px solid #353a42',
              borderRadius: 0,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm({
                sourcePort: parseInt(sourcePort, 10),
                targetPort: parseInt(targetPort, 10),
              })
            }
            disabled={!valid}
            style={{
              padding: '8px 12px',
              background: valid ? '#2ea44f' : '#2ea44f',
              opacity: valid ? 1 : 0.6,
              color: '#fff',
              border: '1px solid #2ea44f',
              borderRadius: 0,
              cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
