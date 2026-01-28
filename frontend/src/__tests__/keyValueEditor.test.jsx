import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KeyValueEditor from '../components/forms/KeyValueEditor';

describe('KeyValueEditor', () => {
  const defaultProps = {
    title: 'Environment Variables',
    rows: [{ id: 'row1', key: 'KEY1', value: 'value1' }],
    onChange: vi.fn(),
    keyPlaceholder: 'Key',
    valuePlaceholder: 'Value',
    addButtonLabel: 'Add Variable',
    ariaPrefix: 'env',
    addButtonId: 'add-env-btn',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders title correctly', () => {
      render(<KeyValueEditor {...defaultProps} />);
      expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    });

    it('renders add button with correct label', () => {
      render(<KeyValueEditor {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: 'Add Variable' }),
      ).toBeInTheDocument();
    });

    it('renders key and value inputs for each row', () => {
      const rows = [
        { id: 'row1', key: 'KEY1', value: 'value1' },
        { id: 'row2', key: 'KEY2', value: 'value2' },
      ];
      render(<KeyValueEditor {...defaultProps} rows={rows} />);

      const keyInputs = screen.getAllByLabelText('env key');
      const valueInputs = screen.getAllByLabelText('env value');

      expect(keyInputs).toHaveLength(2);
      expect(valueInputs).toHaveLength(2);
    });

    it('renders remove button for each row', () => {
      const rows = [
        { id: 'row1', key: 'KEY1', value: 'value1' },
        { id: 'row2', key: 'KEY2', value: 'value2' },
      ];
      render(<KeyValueEditor {...defaultProps} rows={rows} />);

      const removeButtons = screen.getAllByLabelText('Remove env row');
      expect(removeButtons).toHaveLength(2);
    });

    it('displays correct values in inputs', () => {
      render(<KeyValueEditor {...defaultProps} />);

      const keyInput = screen.getByLabelText('env key');
      const valueInput = screen.getByLabelText('env value');

      expect(keyInput).toHaveValue('KEY1');
      expect(valueInput).toHaveValue('value1');
    });

    it('renders placeholders correctly', () => {
      render(
        <KeyValueEditor
          {...defaultProps}
          rows={[{ id: 'row1', key: '', value: '' }]}
        />,
      );

      const keyInput = screen.getByLabelText('env key');
      const valueInput = screen.getByLabelText('env value');

      expect(keyInput).toHaveAttribute('placeholder', 'Key');
      expect(valueInput).toHaveAttribute('placeholder', 'Value');
    });

    it('handles undefined rows gracefully', () => {
      render(<KeyValueEditor {...defaultProps} rows={undefined} />);
      expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    });

    it('handles null rows gracefully', () => {
      render(<KeyValueEditor {...defaultProps} rows={null} />);
      expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    });

    it('renders add button with correct id', () => {
      render(<KeyValueEditor {...defaultProps} />);
      const addButton = screen.getByRole('button', { name: 'Add Variable' });
      expect(addButton).toHaveAttribute('id', 'add-env-btn');
    });
  });

  describe('interactions', () => {
    it('calls onChange when key is modified', () => {
      const onChange = vi.fn();
      render(<KeyValueEditor {...defaultProps} onChange={onChange} />);

      const keyInput = screen.getByLabelText('env key');
      fireEvent.change(keyInput, { target: { value: 'NEW_KEY' } });

      expect(onChange).toHaveBeenCalledWith([
        { id: 'row1', key: 'NEW_KEY', value: 'value1' },
      ]);
    });

    it('calls onChange when value is modified', () => {
      const onChange = vi.fn();
      render(<KeyValueEditor {...defaultProps} onChange={onChange} />);

      const valueInput = screen.getByLabelText('env value');
      fireEvent.change(valueInput, { target: { value: 'new_value' } });

      expect(onChange).toHaveBeenCalledWith([
        { id: 'row1', key: 'KEY1', value: 'new_value' },
      ]);
    });

    it('calls onChange with new row when add button is clicked', () => {
      const onChange = vi.fn();
      render(<KeyValueEditor {...defaultProps} onChange={onChange} />);

      const addButton = screen.getByRole('button', { name: 'Add Variable' });
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalled();
      const newRows = onChange.mock.calls[0][0];
      expect(newRows).toHaveLength(2);
      expect(newRows[1].key).toBe('');
      expect(newRows[1].value).toBe('');
    });

    it('removes a row when remove button is clicked', () => {
      const onChange = vi.fn();
      const rows = [
        { id: 'row1', key: 'KEY1', value: 'value1' },
        { id: 'row2', key: 'KEY2', value: 'value2' },
      ];
      render(
        <KeyValueEditor {...defaultProps} rows={rows} onChange={onChange} />,
      );

      const removeButtons = screen.getAllByLabelText('Remove env row');
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith([
        { id: 'row2', key: 'KEY2', value: 'value2' },
      ]);
    });

    it('keeps at least one empty row when last row is removed', () => {
      const onChange = vi.fn();
      const rows = [{ id: 'row1', key: 'KEY1', value: 'value1' }];
      render(
        <KeyValueEditor {...defaultProps} rows={rows} onChange={onChange} />,
      );

      const removeButton = screen.getByLabelText('Remove env row');
      fireEvent.click(removeButton);

      expect(onChange).toHaveBeenCalled();
      const newRows = onChange.mock.calls[0][0];
      expect(newRows).toHaveLength(1);
      expect(newRows[0].key).toBe('');
      expect(newRows[0].value).toBe('');
    });

    it('modifies correct row when multiple rows exist', () => {
      const onChange = vi.fn();
      const rows = [
        { id: 'row1', key: 'KEY1', value: 'value1' },
        { id: 'row2', key: 'KEY2', value: 'value2' },
        { id: 'row3', key: 'KEY3', value: 'value3' },
      ];
      render(
        <KeyValueEditor {...defaultProps} rows={rows} onChange={onChange} />,
      );

      const keyInputs = screen.getAllByLabelText('env key');
      fireEvent.change(keyInputs[1], { target: { value: 'MODIFIED_KEY' } });

      expect(onChange).toHaveBeenCalledWith([
        { id: 'row1', key: 'KEY1', value: 'value1' },
        { id: 'row2', key: 'MODIFIED_KEY', value: 'value2' },
        { id: 'row3', key: 'KEY3', value: 'value3' },
      ]);
    });
  });

  describe('accessibility', () => {
    it('has accessible labels for key inputs', () => {
      render(<KeyValueEditor {...defaultProps} />);
      expect(screen.getByLabelText('env key')).toBeInTheDocument();
    });

    it('has accessible labels for value inputs', () => {
      render(<KeyValueEditor {...defaultProps} />);
      expect(screen.getByLabelText('env value')).toBeInTheDocument();
    });

    it('has accessible label for add button', () => {
      render(<KeyValueEditor {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: 'Add Variable' }),
      ).toBeInTheDocument();
    });

    it('has accessible labels for remove buttons', () => {
      render(<KeyValueEditor {...defaultProps} />);
      expect(screen.getByLabelText('Remove env row')).toBeInTheDocument();
    });
  });
});
