import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextField from '../components/forms/TextField';

describe('TextField', () => {
  describe('rendering', () => {
    it('renders input with correct id', () => {
      render(<TextField id="test-field" label="Name" value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'test-field');
    });

    it('renders label correctly', () => {
      render(
        <TextField id="test-field" label="Username" value="" onChange={vi.fn()} />
      );
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('displays current value', () => {
      render(
        <TextField id="test-field" label="Name" value="John Doe" onChange={vi.fn()} />
      );
      expect(screen.getByRole('textbox')).toHaveValue('John Doe');
    });

    it('displays placeholder text', () => {
      render(
        <TextField
          id="test-field"
          label="Email"
          value=""
          onChange={vi.fn()}
          placeholder="Enter your email"
        />
      );
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Enter your email');
    });
  });

  describe('interactions', () => {
    it('calls onChange when value changes', () => {
      const onChange = vi.fn();
      render(<TextField id="test-field" label="Name" value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Value' } });

      expect(onChange).toHaveBeenCalledWith('New Value');
    });

    it('calls onChange with each keystroke', () => {
      const onChange = vi.fn();
      render(<TextField id="test-field" label="Name" value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });

      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('validation', () => {
    it('shows required indicator when required is true', () => {
      const { container } = render(
        <TextField
          id="test-field"
          label="Required Field"
          value=""
          onChange={vi.fn()}
          required
        />
      );
      const label = container.querySelector('label');
      if (!label) throw new Error('Expected label element');
      expect(label.textContent).toContain('*');
    });

    it('displays error message when error is provided', () => {
      render(
        <TextField
          id="test-field"
          label="Name"
          value=""
          onChange={vi.fn()}
          error="This field is required"
        />
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('associates label with input via htmlFor', () => {
      render(
        <TextField id="my-input" label="My Label" value="" onChange={vi.fn()} />
      );
      const label = screen.getByText('My Label');
      expect(label).toHaveAttribute('for', 'my-input');
    });
  });
});
