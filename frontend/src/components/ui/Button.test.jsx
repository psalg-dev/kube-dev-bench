import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders with default type button', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="primary" size="sm">
        Confirm
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Confirm' });
    expect(button).toHaveClass('ui-button');
    expect(button).toHaveClass('ui-button-primary');
    expect(button).toHaveClass('ui-button-sm');
  });

  it('fires onClick when pressed', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
