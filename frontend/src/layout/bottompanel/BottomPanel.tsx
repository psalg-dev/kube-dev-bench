import { forwardRef, useEffect, useRef, useState } from 'react';
import TabLabel from '../../components/TabLabel';

type BottomPanelTab = {
  key?: string;
  id?: string;
  label: string;
  countKey?: string;
  countable?: boolean;
  ariaLabel?: string;
  testId?: string;
  content?: React.ReactNode;
};

type BottomPanelProps = {
  open: boolean;
  onClose?: () => void;
  tabs?: BottomPanelTab[];
  activeTab?: string;
  onTabChange?: (_tabKey: string) => void;
  headerRight?: React.ReactNode;
  tabCounts?: Record<string, number>;
  tabCountsLoading?: boolean;
  children?: React.ReactNode;
};
const BottomPanel = forwardRef<HTMLDivElement, BottomPanelProps>(function BottomPanel(
  {
    open,
    onClose,
    tabs = [],
    activeTab,
    onTabChange,
    headerRight = null,
    tabCounts = {},
    tabCountsLoading = false,
    children,
  },
  ref
) {
  const [height, setHeight] = useState(() => {
    try {
      return Number(localStorage.getItem('bottompanel.height')) || 360;
    } catch {
      return 360;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef({ startY: 0, startH: 0, resizing: false });

  useEffect(() => {
    try {
      localStorage.setItem('bottompanel.height', String(height));
    } catch {}
  }, [height]);

  if (!open) return null;

  const startResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    resizeRef.current = { startY, startH: height, resizing: true };
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.resizing) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dy = resizeRef.current.startY - ev.clientY; // up increases height
      const next = Math.max(
        160,
        Math.min(resizeRef.current.startH + dy, Math.floor(window.innerHeight * 0.9))
      );
      setHeight(next);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };

    const onUp = (ev?: MouseEvent) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      resizeRef.current.resizing = false;
      setIsResizing(false);
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
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        background: 'var(--gh-bg, #0d1117)',
        color: 'var(--gh-text, #c9d1d9)',
        borderTop: '1px solid var(--gh-border, #30363d)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        transition: isResizing ? 'none' : 'height 0.12s ease-out',
      }}
    >
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        data-resizing="true"
        style={{
          height: 6,
          cursor: 'ns-resize',
          background: 'transparent',
          borderTop: '2px solid var(--gh-border, #30363d)',
          borderBottom: '1px solid var(--gh-border, #30363d)',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'var(--gh-bg-sidebar, #161b22)',
          borderBottom: '1px solid var(--gh-border, #30363d)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            rowGap: 6,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {tabs.map((t) => {
            const tabKey = t.key || t.id || '';
            const countKey = t.countKey || tabKey;
            const count = tabCounts[countKey];
            const showCount = t.countable !== false && typeof count === 'number';
            const isLoading = tabCountsLoading && t.countable !== false;
            const isEmpty = showCount && count === 0;

            return (
              <button
                key={tabKey}
                onClick={() => onTabChange && onTabChange(tabKey)}
                data-testid={t.testId || `tab-${tabKey}`}
                aria-label={t.ariaLabel || t.label}
                style={{
                  border: '1px solid var(--gh-border, #30363d)',
                  borderBottom:
                    activeTab === tabKey
                      ? '2px solid var(--gh-accent, #238636)'
                      : '1px solid var(--gh-border, #30363d)',
                  background:
                    activeTab === tabKey
                      ? 'rgba(56, 139, 253, 0.08)'
                      : 'transparent',
                  color: 'var(--gh-text, #c9d1d9)',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderRadius: 0,
                  fontSize: 13,
                  opacity: isEmpty && activeTab !== tabKey ? 0.6 : 1,
                }}
              >
                <TabLabel
                  label={t.label}
                  count={count}
                  loading={isLoading}
                  showCount={showCount || isLoading}
                />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerRight}
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--gh-text, #c9d1d9)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {children || tabs.find((t) => (t.key || t.id) === activeTab)?.content}
      </div>
    </div>
  );
});

export default BottomPanel;
