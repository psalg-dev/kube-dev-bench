import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggle from '../components/forms/ViewToggle';

describe('ViewToggle', () => {
  describe('rendering', () => {
    it('renders Form and YAML buttons', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Form' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'YAML' })).toBeInTheDocument();
    });

    it('renders container with correct id', () => {
      const { container } = render(<ViewToggle mode="form" onChange={vi.fn()} />);
      expect(container.querySelector('#swarm-view-toggle')).toBeInTheDocument();
    });

    it('renders Form button with correct id', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      const formButton = screen.getByRole('button', { name: 'Form' });
      expect(formButton).toHaveAttribute('id', 'swarm-view-form-btn');
    });

    it('renders YAML button with correct id', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      const yamlButton = screen.getByRole('button', { name: 'YAML' });
      expect(yamlButton).toHaveAttribute('id', 'swarm-view-yaml-btn');
    });
  });

  describe('mode selection', () => {
    it('sets Form button as pressed when mode is form', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      const formButton = screen.getByRole('button', { name: 'Form' });
      const yamlButton = screen.getByRole('button', { name: 'YAML' });
      
      expect(formButton).toHaveAttribute('aria-pressed', 'true');
      expect(yamlButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('sets YAML button as pressed when mode is yaml', () => {
      render(<ViewToggle mode="yaml" onChange={vi.fn()} />);
      const formButton = screen.getByRole('button', { name: 'Form' });
      const yamlButton = screen.getByRole('button', { name: 'YAML' });
      
      expect(formButton).toHaveAttribute('aria-pressed', 'false');
      expect(yamlButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('interactions', () => {
    it('calls onChange with "form" when Form button is clicked', () => {
      const onChange = vi.fn();
      render(<ViewToggle mode="yaml" onChange={onChange} />);
      
      const formButton = screen.getByRole('button', { name: 'Form' });
      fireEvent.click(formButton);
      
      expect(onChange).toHaveBeenCalledWith('form');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('calls onChange with "yaml" when YAML button is clicked', () => {
      const onChange = vi.fn();
      render(<ViewToggle mode="form" onChange={onChange} />);
      
      const yamlButton = screen.getByRole('button', { name: 'YAML' });
      fireEvent.click(yamlButton);
      
      expect(onChange).toHaveBeenCalledWith('yaml');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('calls onChange even when clicking the already selected mode', () => {
      const onChange = vi.fn();
      render(<ViewToggle mode="form" onChange={onChange} />);
      
      const formButton = screen.getByRole('button', { name: 'Form' });
      fireEvent.click(formButton);
      
      expect(onChange).toHaveBeenCalledWith('form');
    });
  });

  describe('styling', () => {
    it('applies active border style to selected button', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      const formButton = screen.getByRole('button', { name: 'Form' });
      
      // Check that active button has green border (can be hex or rgb)
      expect(formButton.style.border).toMatch(/2ea44f|rgb\(46,\s*164,\s*79\)/);
    });

    it('applies default border style to unselected button', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      const yamlButton = screen.getByRole('button', { name: 'YAML' });
      
      // Check that inactive button has default border (can be hex or rgb)
      expect(yamlButton.style.border).toMatch(/30363d|rgb\(48,\s*54,\s*61\)/);
    });

    it('swaps styles when mode changes', () => {
      const { rerender } = render(<ViewToggle mode="form" onChange={vi.fn()} />);
      
      let formButton = screen.getByRole('button', { name: 'Form' });
      let yamlButton = screen.getByRole('button', { name: 'YAML' });
      
      expect(formButton.style.border).toMatch(/2ea44f|rgb\(46,\s*164,\s*79\)/);
      expect(yamlButton.style.border).toMatch(/30363d|rgb\(48,\s*54,\s*61\)/);
      
      rerender(<ViewToggle mode="yaml" onChange={vi.fn()} />);
      
      formButton = screen.getByRole('button', { name: 'Form' });
      yamlButton = screen.getByRole('button', { name: 'YAML' });
      
      expect(formButton.style.border).toMatch(/30363d|rgb\(48,\s*54,\s*61\)/);
      expect(yamlButton.style.border).toMatch(/2ea44f|rgb\(46,\s*164,\s*79\)/);
    });
  });

  describe('accessibility', () => {
    it('buttons have type="button" to prevent form submission', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('uses aria-pressed for toggle state indication', () => {
      render(<ViewToggle mode="form" onChange={vi.fn()} />);
      
      expect(screen.getByRole('button', { name: 'Form' })).toHaveAttribute('aria-pressed');
      expect(screen.getByRole('button', { name: 'YAML' })).toHaveAttribute('aria-pressed');
    });
  });
});
