import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkActionBar from '../components/BulkActionBar.jsx';

describe('BulkActionBar', () => {
  const defaultActions = [
    { key: 'delete', label: 'Delete', icon: '🗑️', danger: true },
    { key: 'restart', label: 'Restart', icon: '🔄' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when selectedCount is 0', () => {
      render(<BulkActionBar selectedCount={0} actions={defaultActions} />);
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    it('renders when selectedCount is greater than 0', () => {
      render(<BulkActionBar selectedCount={3} actions={defaultActions} />);
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('displays the correct selected count', () => {
      render(<BulkActionBar selectedCount={5} actions={defaultActions} />);
      expect(screen.getByTestId('bulk-action-count')).toHaveTextContent('5 selected');
    });

    it('renders all action buttons', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} />);
      expect(screen.getByTestId('bulk-action-delete')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-action-restart')).toBeInTheDocument();
    });

    it('renders clear selection button', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} />);
      expect(screen.getByTestId('bulk-action-clear')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('calls onClick when action button is clicked', () => {
      const onDelete = vi.fn();
      const actions = [
        { key: 'delete', label: 'Delete', icon: '🗑️', onClick: onDelete },
      ];

      render(<BulkActionBar selectedCount={1} actions={actions} />);
      fireEvent.click(screen.getByTestId('bulk-action-delete'));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('disables action button when action.disabled is true', () => {
      const actions = [
        { key: 'delete', label: 'Delete', disabled: true },
      ];

      render(<BulkActionBar selectedCount={1} actions={actions} />);
      expect(screen.getByTestId('bulk-action-delete')).toBeDisabled();
    });

    it('disables all buttons when disabled prop is true', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} disabled />);
      expect(screen.getByTestId('bulk-action-delete')).toBeDisabled();
      expect(screen.getByTestId('bulk-action-restart')).toBeDisabled();
      expect(screen.getByTestId('bulk-action-clear')).toBeDisabled();
    });

    it('applies danger styling to danger actions', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} />);
      const deleteButton = screen.getByTestId('bulk-action-delete');
      expect(deleteButton.className).toContain('bulk-action-danger');
    });

    it('shows icon in action button', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} />);
      const deleteButton = screen.getByTestId('bulk-action-delete');
      expect(deleteButton).toHaveTextContent('🗑️');
      expect(deleteButton).toHaveTextContent('Delete');
    });
  });

  describe('clear selection', () => {
    it('calls onClearSelection when clear button is clicked', () => {
      const onClear = vi.fn();
      render(<BulkActionBar selectedCount={1} actions={defaultActions} onClearSelection={onClear} />);
      
      fireEvent.click(screen.getByTestId('bulk-action-clear'));
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has toolbar role', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} />);
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('has aria-label on toolbar', () => {
      render(<BulkActionBar selectedCount={1} actions={defaultActions} />);
      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Bulk actions');
    });
  });
});
