import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge, { getStatusColor } from '../components/StatusBadge';

describe('StatusBadge', () => {
  describe('rendering', () => {
    it('renders status text correctly', () => {
      render(<StatusBadge status="Running" />);
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('renders "Unknown" when status is undefined', () => {
      render(<StatusBadge status={undefined} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders "Unknown" when status is null', () => {
      render(<StatusBadge status={null as unknown as string} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders "Unknown" when status is empty string', () => {
      render(<StatusBadge status="" />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('shows status dot by default', () => {
      const { container } = render(<StatusBadge status="Running" />);
      expect(container.querySelector('.status-dot')).toBeInTheDocument();
    });

    it('hides status dot when showDot is false', () => {
      const { container } = render(<StatusBadge status="Running" showDot={false} />);
      expect(container.querySelector('.status-dot')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<StatusBadge status="Running" className="custom-class" />);
      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('size variants', () => {
    it('applies no size class for medium (default)', () => {
      const { container } = render(<StatusBadge status="Running" size="medium" />);
      const badge = container.querySelector('.status-badge');
      expect(badge).not.toHaveClass('status-badge-small');
      expect(badge).not.toHaveClass('status-badge-large');
    });

    it('applies small size class', () => {
      const { container } = render(<StatusBadge status="Running" size="small" />);
      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('status-badge-small');
    });

    it('applies large size class', () => {
      const { container } = render(<StatusBadge status="Running" size="large" />);
      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('status-badge-large');
    });
  });

  describe('getStatusColor', () => {
    it('returns green for success states', () => {
      const successStatuses = [
        'running',
        'ready',
        'available',
        'active',
        'healthy',
        'complete',
        'succeeded',
        'bound',
        'deployed',
      ];
      successStatuses.forEach((status) => {
        expect(getStatusColor(status)).toBe('#3fb950');
      });
    });

    it('returns yellow for warning states', () => {
      const warningStatuses = [
        'pending',
        'creating',
        'preparing',
        'starting',
        'waiting',
        'initializing',
        'terminating',
        'suspended',
        'pause',
        'paused',
        'uninstalling',
      ];
      warningStatuses.forEach((status) => {
        expect(getStatusColor(status)).toBe('#d29922');
      });
    });

    it('returns red for error states', () => {
      const errorStatuses = [
        'failed',
        'error',
        'crashloopbackoff',
        'imagepullbackoff',
        'errpullimage',
        'rejected',
        'lost',
        'inactive',
        'deleted',
        'down',
        'notready',
        'drain',
        'stopped',
      ];
      errorStatuses.forEach((status) => {
        expect(getStatusColor(status)).toBe('#f85149');
      });
    });

    it('returns gray for unknown states', () => {
      const neutralStatuses = ['unknown', 'released', 'terminated', 'superseded'];
      neutralStatuses.forEach((status) => {
        expect(getStatusColor(status)).toBe('#8b949e');
      });
    });

    it('handles case insensitivity', () => {
      expect(getStatusColor('RUNNING')).toBe('#3fb950');
      expect(getStatusColor('Running')).toBe('#3fb950');
      expect(getStatusColor('rUnNiNg')).toBe('#3fb950');
    });

    it('handles spaces, dashes, and underscores', () => {
      expect(getStatusColor('crash loop back off')).toBe('#f85149');
      expect(getStatusColor('crash-loop-back-off')).toBe('#f85149');
      expect(getStatusColor('crash_loop_back_off')).toBe('#f85149');
    });

    it('returns gray for undefined or null status', () => {
      expect(getStatusColor(undefined)).toBe('#8b949e');
      expect(getStatusColor(null as unknown as string)).toBe('#8b949e');
    });

    it('returns gray for unknown status values', () => {
      expect(getStatusColor('someRandomStatus')).toBe('#8b949e');
      expect(getStatusColor('notAValidStatus')).toBe('#8b949e');
    });
  });

  describe('styling', () => {
    it('applies inline styles with correct color', () => {
      const { container } = render(<StatusBadge status="Running" />);
      const badge = container.querySelector('.status-badge') as HTMLElement | null;
      if (!badge) throw new Error('Expected status badge element');
      expect(badge).toHaveStyle({ color: '#3fb950' });
    });

    it('applies correct background color with transparency', () => {
      const { container } = render(<StatusBadge status="Failed" />);
      const badge = container.querySelector('.status-badge') as HTMLElement | null;
      if (!badge) throw new Error('Expected status badge element');
      expect(badge.style.background).toContain('rgba');
    });

    it('applies correct border color with transparency', () => {
      const { container } = render(<StatusBadge status="Pending" />);
      const badge = container.querySelector('.status-badge') as HTMLElement | null;
      if (!badge) throw new Error('Expected status badge element');
      expect(badge.style.border).toContain('rgba');
    });
  });
});