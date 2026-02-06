import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthStatusBadge from '../docker/resources/tasks/HealthStatusBadge';

describe('HealthStatusBadge', () => {
  describe('status display', () => {
    it('displays healthy status', () => {
      render(<HealthStatusBadge status="healthy" />);

      expect(screen.getByText('healthy')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('displays unhealthy status', () => {
      render(<HealthStatusBadge status="unhealthy" />);

      expect(screen.getByText('unhealthy')).toBeInTheDocument();
      expect(screen.getByText('!')).toBeInTheDocument();
    });

    it('displays starting status', () => {
      render(<HealthStatusBadge status="starting" />);

      expect(screen.getByText('starting')).toBeInTheDocument();
      expect(screen.getByText('…')).toBeInTheDocument();
    });

    it('displays none for unknown status', () => {
      render(<HealthStatusBadge status="unknown" />);

      expect(screen.getByText('none')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('displays none for null status', () => {
      render(<HealthStatusBadge status={null} />);

      expect(screen.getByText('none')).toBeInTheDocument();
    });

    it('displays none for undefined status', () => {
      render(<HealthStatusBadge />);

      expect(screen.getByText('none')).toBeInTheDocument();
    });
  });

  describe('case normalization', () => {
    it('normalizes HEALTHY to healthy', () => {
      render(<HealthStatusBadge status="HEALTHY" />);

      expect(screen.getByText('healthy')).toBeInTheDocument();
    });

    it('normalizes Unhealthy to unhealthy', () => {
      render(<HealthStatusBadge status="Unhealthy" />);

      expect(screen.getByText('unhealthy')).toBeInTheDocument();
    });

    it('normalizes STARTING to starting', () => {
      render(<HealthStatusBadge status="STARTING" />);

      expect(screen.getByText('starting')).toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('shows health label in title when no lastCheckAt', () => {
      render(<HealthStatusBadge status="healthy" />);

      const badge = screen.getByTitle('Health: healthy');
      expect(badge).toBeInTheDocument();
    });

    it('shows last check time in title when lastCheckAt provided', () => {
      render(
        <HealthStatusBadge status="healthy" lastCheckAt="2024-01-01T10:00:00Z" />
      );

      const badge = screen.getByTitle('Last check: 2024-01-01T10:00:00Z');
      expect(badge).toBeInTheDocument();
    });
  });
});
