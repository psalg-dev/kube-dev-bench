import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkProgressDialog from '../components/BulkProgressDialog.jsx';

describe('BulkProgressDialog', () => {
  const defaultItems = [
    { key: 'item-1', name: 'item-1', namespace: 'default', status: 'success' },
    { key: 'item-2', name: 'item-2', namespace: 'default', status: 'running' },
    { key: 'item-3', name: 'item-3', namespace: 'default', status: 'pending' },
  ];

  const defaultProps = {
    open: true,
    title: 'Deleting Resources',
    items: defaultItems,
    completed: 1,
    total: 3,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when closed', () => {
      render(<BulkProgressDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays title', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByText('Deleting Resources')).toBeInTheDocument();
    });

    it('displays progress text', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByText('1 / 3 (33%)')).toBeInTheDocument();
    });

    it('displays items list', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      const list = screen.getByTestId('bulk-progress-items');
      expect(list).toContainHTML('item-1');
      expect(list).toContainHTML('item-2');
      expect(list).toContainHTML('item-3');
    });
  });

  describe('status icons', () => {
    it('shows success icon for completed items', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('shows running icon for in-progress items', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByText('⟳')).toBeInTheDocument();
    });

    it('shows pending icon for waiting items', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('shows error icon for failed items', () => {
      const itemsWithError = [
        { key: 'item-1', name: 'item-1', status: 'error', error: 'Failed to delete' },
      ];
      render(<BulkProgressDialog {...defaultProps} items={itemsWithError} />);
      expect(screen.getByText('✗')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error message for failed items', () => {
      const itemsWithError = [
        { key: 'item-1', name: 'item-1', status: 'error', error: 'Resource not found' },
      ];
      render(<BulkProgressDialog {...defaultProps} items={itemsWithError} completed={1} total={1} />);
      expect(screen.getByText('Resource not found')).toBeInTheDocument();
    });
  });

  describe('completion state', () => {
    it('disables close button when not complete', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByTestId('bulk-progress-close')).toBeDisabled();
    });

    it('enables close button when complete', () => {
      render(<BulkProgressDialog {...defaultProps} completed={3} total={3} />);
      expect(screen.getByTestId('bulk-progress-close')).not.toBeDisabled();
    });

    it('shows summary when complete', () => {
      const completedItems = defaultItems.map(i => ({ ...i, status: 'success' }));
      render(<BulkProgressDialog {...defaultProps} items={completedItems} completed={3} total={3} />);
      expect(screen.getByText('3 succeeded')).toBeInTheDocument();
    });

    it('shows error count in summary when there are failures', () => {
      const mixedItems = [
        { key: 'item-1', name: 'item-1', status: 'success' },
        { key: 'item-2', name: 'item-2', status: 'error', error: 'Failed' },
      ];
      render(<BulkProgressDialog {...defaultProps} items={mixedItems} completed={2} total={2} />);
      expect(screen.getByText('1 succeeded')).toBeInTheDocument();
      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });
  });

  describe('retry functionality', () => {
    it('shows retry button when complete with errors', () => {
      const itemsWithError = [
        { key: 'item-1', name: 'item-1', status: 'success' },
        { key: 'item-2', name: 'item-2', status: 'error', error: 'Failed' },
      ];
      const onRetry = vi.fn();
      render(
        <BulkProgressDialog
          {...defaultProps}
          items={itemsWithError}
          completed={2}
          total={2}
          onRetryFailed={onRetry}
        />
      );
      expect(screen.getByTestId('bulk-progress-retry')).toBeInTheDocument();
    });

    it('calls onRetryFailed when retry button clicked', () => {
      const itemsWithError = [
        { key: 'item-1', name: 'item-1', status: 'error', error: 'Failed' },
      ];
      const onRetry = vi.fn();
      render(
        <BulkProgressDialog
          {...defaultProps}
          items={itemsWithError}
          completed={1}
          total={1}
          onRetryFailed={onRetry}
        />
      );
      
      fireEvent.click(screen.getByTestId('bulk-progress-retry'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not show retry button when no errors', () => {
      const successItems = defaultItems.map(i => ({ ...i, status: 'success' }));
      render(<BulkProgressDialog {...defaultProps} items={successItems} completed={3} total={3} />);
      expect(screen.queryByTestId('bulk-progress-retry')).not.toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      const successItems = defaultItems.map(i => ({ ...i, status: 'success' }));
      render(<BulkProgressDialog {...defaultProps} items={successItems} completed={3} total={3} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('bulk-progress-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape pressed and complete', () => {
      const onClose = vi.fn();
      const successItems = defaultItems.map(i => ({ ...i, status: 'success' }));
      render(<BulkProgressDialog {...defaultProps} items={successItems} completed={3} total={3} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on Escape when not complete', () => {
      const onClose = vi.fn();
      render(<BulkProgressDialog {...defaultProps} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has dialog role', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute on overlay', () => {
      render(<BulkProgressDialog {...defaultProps} />);
      const overlay = document.querySelector('.bulk-progress-overlay');
      expect(overlay).toHaveAttribute('aria-modal', 'true');
    });
  });
});
