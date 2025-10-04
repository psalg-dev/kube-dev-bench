import React, { useEffect, useRef, useState, forwardRef } from 'react';

const BottomPanel = forwardRef(function BottomPanel({ open, onClose, tabs = [], activeTab, onTabChange, headerRight = null, children }, ref) {
  const [height, setHeight] = useState(() => {
    try { return Number(localStorage.getItem('bottompanel.height')) || 360; } catch { return 360; }
  });
  const resizeRef = useRef({ startY: 0, startH: 0, resizing: false });

  useEffect(() => {
    try { localStorage.setItem('bottompanel.height', String(height)); } catch {}
  }, [height]);

  if (!open) return null;

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    resizeRef.current = { startY, startH: height, resizing: true };

    const onMove = (ev) => {
      if (!resizeRef.current.resizing) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dy = resizeRef.current.startY - ev.clientY; // up increases height
      const next = Math.max(160, Math.min(resizeRef.current.startH + dy, Math.floor(window.innerHeight * 0.9)));
      setHeight(next);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };

    const onUp = (ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      resizeRef.current.resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={ref}
      className="bottom-panel"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        height,
        background: 'var(--gh-bg, #0d1117)',
        color: 'var(--gh-text, #c9d1d9)',
        borderTop: '1px solid var(--gh-border, #30363d)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        transition: resizeRef.current.resizing ? 'none' : 'height 0.12s ease-out'
      }}>
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        data-resizing="true"
        style={{
          height: 6,
          cursor: 'ns-resize',
          background: 'transparent',
          borderTop: '2px solid var(--gh-border, #30363d)',
          borderBottom: '1px solid var(--gh-border, #30363d)'
        }}
      />
      {/* Tabs header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        background: 'var(--gh-bg-sidebar, #161b22)',
        borderBottom: '1px solid var(--gh-border, #30363d)'
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map(t => (
            <button key={t.key || t.id}
              onClick={() => onTabChange && onTabChange(t.key || t.id)}
              style={{
                border: '1px solid var(--gh-border, #30363d)',
                borderBottom: activeTab === (t.key || t.id) ? '2px solid var(--gh-accent, #238636)' : '1px solid var(--gh-border, #30363d)',
                background: activeTab === (t.key || t.id) ? 'rgba(56, 139, 253, 0.08)' : 'transparent',
                color: 'var(--gh-text, #c9d1d9)',
                padding: '6px 10px',
                cursor: 'pointer',
                borderRadius: 0,
                fontSize: 13
              }}
            >{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} title="Close" style={{
            background: 'transparent', border: 'none', color: 'var(--gh-text, #c9d1d9)', cursor: 'pointer', fontSize: 18
          }}>✕</button>
        </div>
      </div>
      {/* Content - Use children prop instead of tabs content */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {children || tabs.find(t => (t.key || t.id) === activeTab)?.content}
      </div>
    </div>
  );
});

export default BottomPanel;
