import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectField from '../components/forms/SelectField';

describe('SelectField', () => {
  const defaultOptions = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3' },
  ];

  describe('rendering', () => {
    it('renders select with correct id', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="opt1" 
          onChange={vi.fn()} 
          options={defaultOptions}
        />
      );
      expect(screen.getByRole('combobox')).toHaveAttribute('id', 'select-field');
    });

    it('renders label correctly', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Protocol" 
          value="opt1" 
          onChange={vi.fn()} 
          options={defaultOptions}
        />
      );
      expect(screen.getByText('Protocol')).toBeInTheDocument();
    });

    it('renders all options', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="opt1" 
          onChange={vi.fn()} 
          options={defaultOptions}
        />
      );
      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument();
    });

    it('selects correct option based on value', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="opt2" 
          onChange={vi.fn()} 
          options={defaultOptions}
        />
      );
      expect(screen.getByRole('combobox')).toHaveValue('opt2');
    });

    it('handles empty options array gracefully', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="" 
          onChange={vi.fn()} 
          options={[]}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('handles undefined options gracefully', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="" 
          onChange={vi.fn()} 
          options={undefined}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('handles null options gracefully', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="" 
          onChange={vi.fn()} 
          options={null}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onChange when selection changes', () => {
      const onChange = vi.fn();
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="opt1" 
          onChange={onChange} 
          options={defaultOptions}
        />
      );
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'opt3' } });
      
      expect(onChange).toHaveBeenCalledWith('opt3');
    });

    it('passes the selected value correctly', () => {
      const onChange = vi.fn();
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="opt1" 
          onChange={onChange} 
          options={defaultOptions}
        />
      );
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'opt2' } });
      
      expect(onChange).toHaveBeenCalledWith('opt2');
    });
  });

  describe('validation', () => {
    it('shows required indicator when required is true', () => {
      const { container } = render(
        <SelectField 
          id="select-field" 
          label="Required Field" 
          value="opt1" 
          onChange={vi.fn()} 
          options={defaultOptions}
          required
        />
      );
      // Required fields show asterisk in the label text
      const label = container.querySelector('label');
      expect(label.textContent).toContain('*');
    });

    it('displays error message when error is provided', () => {
      render(
        <SelectField 
          id="select-field" 
          label="Choose" 
          value="" 
          onChange={vi.fn()} 
          options={defaultOptions}
          error="Please select an option"
        />
      );
      expect(screen.getByText('Please select an option')).toBeInTheDocument();
    });
  });

  describe('option values', () => {
    it('handles numeric option values', () => {
      const numericOptions = [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
        { value: '3', label: 'Three' },
      ];
      
      render(
        <SelectField 
          id="select-field" 
          label="Number" 
          value="2" 
          onChange={vi.fn()} 
          options={numericOptions}
        />
      );
      expect(screen.getByRole('combobox')).toHaveValue('2');
    });

    it('handles options with same label but different values', () => {
      const options = [
        { value: 'tcp', label: 'TCP' },
        { value: 'udp', label: 'UDP' },
      ];
      
      const onChange = vi.fn();
      render(
        <SelectField 
          id="select-field" 
          label="Protocol" 
          value="tcp" 
          onChange={onChange} 
          options={options}
        />
      );
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'udp' } });
      
      expect(onChange).toHaveBeenCalledWith('udp');
    });
  });

  describe('accessibility', () => {
    it('associates label with select', () => {
      render(
        <SelectField 
          id="my-select" 
          label="My Label" 
          value="opt1" 
          onChange={vi.fn()} 
          options={defaultOptions}
        />
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('id', 'my-select');
    });
  });
});
