import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HolmesResponseRenderer from '../holmes/HolmesResponseRenderer.jsx';

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe('HolmesResponseRenderer', () => {
  it('renders markdown content', () => {
    render(<HolmesResponseRenderer text={'# Title\n\nA **bold** word.'} />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('renders code blocks with copy button', () => {
    render(
      <HolmesResponseRenderer text={'```js\nconst x = 1;\n```'} />
    );

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const x = 1;');
  });
});
