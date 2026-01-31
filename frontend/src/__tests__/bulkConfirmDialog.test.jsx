import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkConfirmDialog from '../components/BulkConfirmDialog.jsx';

describe('BulkConfirmDialog', () => {
  const defaultItems = [
    { name: 'item-1', namespace: 'default' },
    { name: 'item-2', namespace: 'default' },
    { name: 'item-3', namespace: 'kube-system' },
  ];

  const defaultProps = {
    open: true,
    actionLabel: 'Delete',
    items: defaultItems,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when closed', () => {
      render(<BulkConfirmDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(<BulkConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays action label in title', () => {
      render(<BulkConfirmDialog {...defaultProps} actionLabel="Restart" />);
      expect(screen.getByText(/Restart 3 items/)).toBeInTheDocument();
    });

    it('uses singular form for single item', () => {
      render(<BulkConfirmDialog {...defaultProps} items={[defaultItems[0]]} />);
      expect(screen.getByText(/Delete 1 item/)).toBeInTheDocument();
    });

    it('displays items list', () => {
      render(<BulkConfirmDialog {...defaultProps} />);
      const list = screen.getByTestId('bulk-confirm-items');
      expect(list).toContainHTML('item-1');
      expect(list).toContainHTML('item-2');
      expect(list).toContainHTML('item-3');
    });

    it('displays namespace prefix for items', () => {
      render(<BulkConfirmDialog {...defaultProps} />);
      expect(screen.getAllByText('default/').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('item list truncation', () => {
    it('shows max 10 items and indicates more', () => {
      const manyItems = Array.from({ length: 15 }, (_, i) => ({
        name: `item-${i}`,
        namespace: 'default',
      }));

      render(<BulkConfirmDialog {...defaultProps} items={manyItems} />);
      expect(screen.getByText(/and 5 more/)).toBeInTheDocument();
    });
  });

  describe('typed count confirmation', () => {
    it('does not require typed count for fewer than 5 items', () => {
      render(<BulkConfirmDialog {...defaultProps} />);
      expect(screen.queryByTestId('bulk-confirm-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('bulk-confirm-submit')).not.toBeDisabled();
    });

    it('requires typed count for 5+ items', () => {
      const manyItems = Array.from({ length: 5 }, (_, i) => ({
        name: `item-${i}`,
        namespace: 'default',
      }));

      render(<BulkConfirmDialog {...defaultProps} items={manyItems} />);
      expect(screen.getByTestId('bulk-confirm-input')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-confirm-submit')).toBeDisabled();
    });

    it('enables confirm when correct count is typed', () => {
      const manyItems = Array.from({ length: 5 }, (_, i) => ({
        name: `item-${i}`,
        namespace: 'default',
      }));

      render(<BulkConfirmDialog {...defaultProps} items={manyItems} />);
      const input = screen.getByTestId('bulk-confirm-input');
      
      fireEvent.change(input, { target: { value: '5' } });
      expect(screen.getByTestId('bulk-confirm-submit')).not.toBeDisabled();
    });

    it('keeps confirm disabled with incorrect count', () => {
      const manyItems = Array.from({ length: 5 }, (_, i) => ({
        name: `item-${i}`,
        namespace: 'default',
      }));

      render(<BulkConfirmDialog {...defaultProps} items={manyItems} />);
      const input = screen.getByTestId('bulk-confirm-input');
      
      fireEvent.change(input, { target: { value: '3' } });
      expect(screen.getByTestId('bulk-confirm-submit')).toBeDisabled();
    });
  });

  describe('warnings', () => {
    it('shows danger icon for destructive operations', () => {
      render(<BulkConfirmDialog {...defaultProps} danger />);
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('shows production warning when hasProductionWarning is true', () => {
      render(<BulkConfirmDialog {...defaultProps} hasProductionWarning />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/production or kube-system/)).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('calls onConfirm when confirm button clicked', () => {
      const onConfirm = vi.fn();
      render(<BulkConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
      
      fireEvent.click(screen.getByTestId('bulk-confirm-submit'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      render(<BulkConfirmDialog {...defaultProps} onCancel={onCancel} />);
      
      fireEvent.click(screen.getByTestId('bulk-confirm-cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Escape key pressed', () => {
      const onCancel = vi.fn();
      render(<BulkConfirmDialog {...defaultProps} onCancel={onCancel} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when clicking outside dialog', () => {
      const onCancel = vi.fn();
      render(<BulkConfirmDialog {...defaultProps} onCancel={onCancel} />);
      
      // Click on overlay (outside dialog)
      const overlay = document.querySelector('.bulk-confirm-overlay');
      fireEvent.click(overlay);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has dialog role', () => {
      render(<BulkConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute on overlay', () => {
      render(<BulkConfirmDialog {...defaultProps} />);
      const overlay = document.querySelector('.bulk-confirm-overlay');
      expect(overlay).toHaveAttribute('aria-modal', 'true');
    });
  });
});
