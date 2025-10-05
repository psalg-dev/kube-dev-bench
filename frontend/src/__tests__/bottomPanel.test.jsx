import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomPanel from '../layout/bottompanel/BottomPanel.jsx';

function Wrapper({ initialTab = 'one', open = true }) {
  const [active, setActive] = useState(initialTab);
  return (
    <BottomPanel
      open={open}
      tabs={[{ key: 'one', label: 'One', content: <div data-testid="content-one">ONE</div> }, { key: 'two', label: 'Two', content: <div data-testid="content-two">TWO</div> }]}
      activeTab={active}
      onTabChange={setActive}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  // Reset DOM & localStorage height
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('BottomPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Wrapper open={false} />);
    expect(container.querySelector('.bottom-panel')).toBeNull();
  });

  it('renders tabs and active content', () => {
    render(<Wrapper />);
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByTestId('content-one')).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(screen.getByTestId('content-two')).toBeInTheDocument();
  });

  it('resizes via drag and stores height', () => {
    render(<Wrapper />);
    const panel = document.querySelector('.bottom-panel');
    const handle = panel.querySelector('[data-resizing]');
    const initial = panel.style.height;
    // Simulate drag upward by 40px (clientY decreases)
    fireEvent.mouseDown(handle, { clientY: 500 });
    fireEvent.mouseMove(document, { clientY: 460 });
    fireEvent.mouseUp(document, { clientY: 460 });
    const after = panel.style.height;
    expect(after).not.toBe(initial);
    expect(Number(after.replace('px',''))).toBeGreaterThan(Number(initial.replace('px','')) - 1); // increased
    // Height persisted
    expect(localStorage.getItem('bottompanel.height')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    function CustomWrapper() {
      const [active, setActive] = useState('one');
      return <BottomPanel open tabs={[{ key: 'one', label: 'One', content: <div /> }]} activeTab={active} onTabChange={setActive} onClose={onClose} />;
    }
    render(<CustomWrapper />);
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

