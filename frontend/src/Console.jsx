import React, { useEffect, useRef, useState } from 'react';

// This component simulates a console that runs a command and displays output.
// In a real app, you would connect this to a backend or use Wails APIs to run the command and stream output.
export default function Console({ command, onClose }) {
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(true);
  const outputRef = useRef(null);

  useEffect(() => {
    // Simulate streaming output for demo purposes
    setOutput(`$ ${command}\n`);
    setRunning(true);
    let i = 0;
    const interval = setInterval(() => {
      if (!running) return;
      setOutput(prev => prev + `log line ${++i}\n`);
      if (i >= 20) {
        setRunning(false);
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
    // In a real app, replace with actual process output streaming
  }, [command]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div style={{
      background: '#181c20',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: 15,
      borderTop: '2px solid #353a42',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.18)',
      width: '100%',
      height: 320,
      position: 'fixed',
      left: 0,
      bottom: 0,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      transition: 'height 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#23272e', padding: '8px 16px', borderBottom: '1px solid #353a42' }}>
        <span>Console</span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#e0e0e0', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>
      <pre ref={outputRef} style={{ flex: 1, margin: 0, padding: '12px 16px', overflowY: 'auto', background: 'inherit' }}>{output}</pre>
    </div>
  );
}

