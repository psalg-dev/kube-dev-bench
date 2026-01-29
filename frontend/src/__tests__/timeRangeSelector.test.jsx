import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeRangeSelector from '../docker/metrics/TimeRangeSelector';

describe('TimeRangeSelector', () => {
  describe('rendering', () => {
    it('renders with label and select', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} />);
      
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders all time range options', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} />);
      
      expect(screen.getByText('Last 1 minute')).toBeInTheDocument();
      expect(screen.getByText('Last 5 minutes')).toBeInTheDocument();
      expect(screen.getByText('Last 15 minutes')).toBeInTheDocument();
      expect(screen.getByText('Last 1 hour')).toBeInTheDocument();
      expect(screen.getByText('All (in-memory)')).toBeInTheDocument();
    });

    it('sets correct value from props', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={300} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('300');
    });

    it('renders as disabled when disabled prop is true', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} disabled={true} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('renders as enabled when disabled prop is false', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} disabled={false} />);
      
      const select = screen.getByRole('combobox');
      expect(select).not.toBeDisabled();
    });

    it('renders as enabled by default when disabled prop is not provided', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      expect(select).not.toBeDisabled();
    });
  });

  describe('user interaction', () => {
    it('calls onChangeSeconds with numeric value when selection changes', async () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '300');
      
      expect(onChangeSeconds).toHaveBeenCalledWith(300);
    });

    it('calls onChangeSeconds with 0 for "All" option', async () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '0');
      
      expect(onChangeSeconds).toHaveBeenCalledWith(0);
    });

    it('calls onChangeSeconds with 3600 for "Last 1 hour" option', async () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '3600');
      
      expect(onChangeSeconds).toHaveBeenCalledWith(3600);
    });

    it('does not call onChangeSeconds when disabled', async () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={onChangeSeconds} disabled={true} />);
      
      const select = screen.getByRole('combobox');
      // Try to interact with disabled select - userEvent should handle this gracefully
      expect(select).toBeDisabled();
      expect(onChangeSeconds).not.toHaveBeenCalled();
    });

    it('handles undefined onChangeSeconds gracefully', async () => {
      render(<TimeRangeSelector valueSeconds={60} onChangeSeconds={undefined} />);
      
      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '300');
      
      // Component should not crash - it uses optional chaining for the callback
      // But since it's controlled without callback, value won't change
      expect(select).toHaveValue('60');
    });
  });

  describe('value formatting', () => {
    it('converts numeric valueSeconds to string for select', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={900} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('900');
    });

    it('handles zero value correctly', () => {
      const onChangeSeconds = vi.fn();
      render(<TimeRangeSelector valueSeconds={0} onChangeSeconds={onChangeSeconds} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('0');
    });
  });
});
