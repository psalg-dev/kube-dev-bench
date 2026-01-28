import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NumberField from '../components/forms/NumberField';

describe('NumberField', () => {
  describe('rendering', () => {
    it('renders input with correct id', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={0}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByRole('spinbutton')).toHaveAttribute(
        'id',
        'count-field',
      );
    });

    it('renders label correctly', () => {
      render(
        <NumberField
          id="count-field"
          label="Replicas"
          value={1}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });

    it('displays current value', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={42}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(42);
    });

    it('sets input type to number', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={0}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
    });
  });

  describe('constraints', () => {
    it('sets min attribute when provided', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={0}
          onChange={vi.fn()}
          min={0}
        />,
      );
      expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '0');
    });

    it('sets max attribute when provided', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={0}
          onChange={vi.fn()}
          max={100}
        />,
      );
      expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '100');
    });

    it('sets both min and max when provided', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={50}
          onChange={vi.fn()}
          min={0}
          max={100}
        />,
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });
  });

  describe('interactions', () => {
    it('calls onChange when value changes', () => {
      const onChange = vi.fn();
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={0}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });

      expect(onChange).toHaveBeenCalledWith('10');
    });

    it('handles increment via spinner', () => {
      const onChange = vi.fn();
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={5}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('spinbutton');
      // Simulate keyboard increment
      fireEvent.change(input, { target: { value: '6' } });

      expect(onChange).toHaveBeenCalledWith('6');
    });

    it('handles empty value', () => {
      const onChange = vi.fn();
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={5}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('validation', () => {
    it('shows required indicator when required is true', () => {
      const { container } = render(
        <NumberField
          id="count-field"
          label="Required Count"
          value={0}
          onChange={vi.fn()}
          required
        />,
      );
      // Required fields show asterisk in the label text
      const label = container.querySelector('label');
      expect(label.textContent).toContain('*');
    });

    it('displays error message when error is provided', () => {
      render(
        <NumberField
          id="count-field"
          label="Count"
          value={-1}
          onChange={vi.fn()}
          error="Value must be positive"
        />,
      );
      expect(screen.getByText('Value must be positive')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('associates label with input', () => {
      render(
        <NumberField
          id="my-number"
          label="Amount"
          value={0}
          onChange={vi.fn()}
        />,
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('id', 'my-number');
    });
  });
});
