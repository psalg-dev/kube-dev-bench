import { useEffect, useMemo, useState } from 'react';
import { BaseModal, ModalButton, ModalPrimaryButton } from '../../../components/BaseModal';

export default function PortForwardDialog({ open, _namespace, podName, onCancel, onConfirm }) {
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
    return Number.isFinite(s) && s > 0 && s <= 65535 && Number.isFinite(t) && t > 20000 && t <= 65535;
  }, [sourcePort, targetPort]);

  if (!open) return null;

  return (
    <BaseModal
      isOpen={open}
      onClose={onCancel}
      title="Port Forward"
      width={440}
      footer={
        <>
          <ModalButton onClick={onCancel}>Cancel</ModalButton>
          <ModalPrimaryButton
            onClick={() => onConfirm({ sourcePort: parseInt(sourcePort, 10), targetPort: parseInt(targetPort, 10) })}
            disabled={!valid}
          >
            Start
          </ModalPrimaryButton>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#bbb' }}>Pod: <strong style={{ color: '#fff' }}>{podName}</strong></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: '#bbb', fontSize: 13 }}>Source port (container)</span>
            <input type="number" min="1" max="65535" value={sourcePort} onChange={(e) => setSourcePort(e.target.value)} style={{ padding: '8px 10px', background: '#23272e', border: '1px solid #353a42', color: '#fff', borderRadius: 0 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: '#bbb', fontSize: 13 }}>Target port (local)</span>
            <input type="number" min="20001" max="65535" value={targetPort} onChange={(e) => setTargetPort(e.target.value)} style={{ padding: '8px 10px', background: '#23272e', border: '1px solid #353a42', color: '#fff', borderRadius: 0 }} />
          </label>
        </div>
        {ports.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#bbb', fontSize: 13 }}>Detected container ports:</span>
            {ports.map((p, idx) => (
              <button key={idx} onClick={() => setSourcePort(String(p))} style={{ padding: '4px 8px', background: '#23272e', border: '1px solid #353a42', color: '#fff', borderRadius: 0, cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        )}
        {loading && <div style={{ color: '#aaa' }}>Loading ports…</div>}
        {error && <div style={{ color: '#d73a49' }}>Error: {error}</div>}
      </div>
    </BaseModal>
  );
}

