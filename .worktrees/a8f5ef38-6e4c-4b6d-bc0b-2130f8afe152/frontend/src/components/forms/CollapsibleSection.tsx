import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CollapsibleSectionProps = {
  id?: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function CollapsibleSection({
  id,
  title,
  count,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const caret = open ? '▼' : '▶';
  const headerText = useMemo(() => `${caret} ${title} (${count ?? 0})`, [caret, title, count]);

  return (
    <div id={id} style={{ borderTop: '1px solid #3c3c3c', paddingTop: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent',
          color: '#fff',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 12,
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        {headerText}
      </button>
      {open ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </div>
  );
}
