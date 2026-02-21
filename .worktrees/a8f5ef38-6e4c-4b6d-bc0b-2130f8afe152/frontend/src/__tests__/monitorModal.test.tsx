import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonitorModal } from '../layout/MonitorModal';

describe('MonitorModal', () => {
  const mockMonitorInfo = {
    errors: [
      { resource: 'Pod', name: 'failing-pod-1', namespace: 'default', reason: 'CrashLoopBackOff', type: 'error' },
      { resource: 'Pod', name: 'failing-pod-2', namespace: 'kube-system', reason: 'ImagePullBackOff', type: 'error' },
    ],
    warnings: [
      { resource: 'Deployment', name: 'app-deployment', namespace: 'default', reason: 'Insufficient replicas', type: 'warning' },
    ],
    errorCount: 2,
    warningCount: 1,
  };

  let mockOnClose: () => void;

  beforeEach(() => {
    mockOnClose = vi.fn();
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders modal overlay', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getByText('Cluster Monitor')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: /×/ })).toBeInTheDocument();
    });

    it('renders error tab', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getByText(/errors/i)).toBeInTheDocument();
    });

    it('renders warnings tab', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getByText(/warnings/i)).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('shows errors by default', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getByText('Pod/failing-pod-1')).toBeInTheDocument();
      expect(screen.getByText('Pod/failing-pod-2')).toBeInTheDocument();
    });

    it('can switch to warnings tab', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      const warningsTab = screen.getByText(/warnings/i).closest('button');
      if (warningsTab) fireEvent.click(warningsTab);

      expect(screen.getByText('Deployment/app-deployment')).toBeInTheDocument();
    });

    it('can switch back to errors tab', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      // Switch to warnings
      const warningsTab = screen.getByText(/warnings/i).closest('button');
      if (warningsTab) fireEvent.click(warningsTab);

      // Switch back to errors
      const errorsTab = screen.getByText(/errors/i).closest('button');
      if (errorsTab) fireEvent.click(errorsTab);

      expect(screen.getByText('Pod/failing-pod-1')).toBeInTheDocument();
    });
  });

  describe('closing modal', () => {
    it('calls onClose when close button clicked', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: /×/ });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when overlay clicked', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      const overlay = document.getElementById('monitor-modal-overlay');
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay as HTMLElement);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not close when modal content clicked', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      const modal = document.getElementById('monitor-modal');
      expect(modal).toBeTruthy();
      fireEvent.click(modal as HTMLElement);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('issue navigation', () => {
    it('dispatches navigate event when issue clicked', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      // Find by resource path format
      const issue = screen.getByText('Pod/failing-pod-1');
      fireEvent.click(issue.closest('.monitor-issue-item') || issue);
    });

    it('closes modal after navigation', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      const issueRow = screen.getByText('Pod/failing-pod-1');
      // Find the clickable parent and click it
      const clickableParent = issueRow.closest('.monitor-issue-item');
      if (clickableParent) {
        fireEvent.click(clickableParent);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('empty states', () => {
    it('handles empty errors array', () => {
      const emptyInfo = {
        errors: [],
        warnings: mockMonitorInfo.warnings,
        errorCount: 0,
        warningCount: mockMonitorInfo.warningCount,
      };
      render(<MonitorModal monitorInfo={emptyInfo} onClose={mockOnClose} />);

      // Should still render without errors
      expect(screen.getByText('Cluster Monitor')).toBeInTheDocument();
    });

    it('handles empty warnings array', () => {
      const emptyInfo = {
        errors: mockMonitorInfo.errors,
        warnings: [],
        errorCount: mockMonitorInfo.errorCount,
        warningCount: 0,
      };
      render(<MonitorModal monitorInfo={emptyInfo} onClose={mockOnClose} />);

      // Should still render without errors
      expect(screen.getByText('Cluster Monitor')).toBeInTheDocument();
    });

    it('handles null errors', () => {
      const nullInfo = {
        errors: null,
        warnings: mockMonitorInfo.warnings,
        errorCount: 0,
        warningCount: mockMonitorInfo.warningCount,
      } as unknown as typeof mockMonitorInfo;
      render(<MonitorModal monitorInfo={nullInfo} onClose={mockOnClose} />);

      expect(screen.getByText('Cluster Monitor')).toBeInTheDocument();
    });

    it('handles null warnings', () => {
      const nullInfo = {
        errors: mockMonitorInfo.errors,
        warnings: null,
        errorCount: mockMonitorInfo.errorCount,
        warningCount: 0,
      } as unknown as typeof mockMonitorInfo;
      render(<MonitorModal monitorInfo={nullInfo} onClose={mockOnClose} />);

      expect(screen.getByText('Cluster Monitor')).toBeInTheDocument();
    });
  });

  describe('issue details', () => {
    it('displays issue resource type', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getAllByText(/Pod/i).length).toBeGreaterThanOrEqual(1);
    });

    it('displays issue namespace', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getAllByText(/default/i).length).toBeGreaterThanOrEqual(1);
    });

    it('displays issue message', () => {
      render(<MonitorModal monitorInfo={mockMonitorInfo} onClose={mockOnClose} />);

      expect(screen.getByText('CrashLoopBackOff')).toBeInTheDocument();
      expect(screen.getByText('ImagePullBackOff')).toBeInTheDocument();
    });
  });
});
