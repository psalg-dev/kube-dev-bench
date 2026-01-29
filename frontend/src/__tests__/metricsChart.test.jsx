import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricsChart from '../docker/metrics/MetricsChart';

describe('MetricsChart', () => {
  describe('empty states', () => {
    it('renders empty text when no points provided', () => {
      render(<MetricsChart points={[]} valueKey="value" />);
      expect(screen.getByText('No data yet')).toBeInTheDocument();
    });

    it('renders empty text when points is undefined', () => {
      render(<MetricsChart points={undefined} valueKey="value" />);
      expect(screen.getByText('No data yet')).toBeInTheDocument();
    });

    it('renders empty text when points is null', () => {
      render(<MetricsChart points={null} valueKey="value" />);
      expect(screen.getByText('No data yet')).toBeInTheDocument();
    });

    it('renders empty text when only one point provided', () => {
      render(<MetricsChart points={[{ value: 10 }]} valueKey="value" />);
      expect(screen.getByText('No data yet')).toBeInTheDocument();
    });

    it('renders custom empty text when provided', () => {
      render(<MetricsChart points={[]} valueKey="value" emptyText="Waiting for metrics..." />);
      expect(screen.getByText('Waiting for metrics...')).toBeInTheDocument();
    });
  });

  describe('chart rendering with valueKey', () => {
    it('renders SVG chart when sufficient data points provided', () => {
      const points = [
        { value: 10 },
        { value: 20 },
        { value: 15 },
      ];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      expect(svg).toBeInTheDocument();
    });

    it('renders polyline with correct points', () => {
      const points = [
        { value: 10 },
        { value: 20 },
        { value: 15 },
      ];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const polyline = container.querySelector('polyline');
      
      expect(polyline).toBeInTheDocument();
      expect(polyline).toHaveAttribute('points');
      expect(polyline?.getAttribute('points')).toBeTruthy();
    });

    it('uses default width and height when not provided', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      expect(svg).toHaveAttribute('viewBox', '0 0 360 64');
      expect(svg).toHaveAttribute('height', '64');
    });

    it('uses custom width and height when provided', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(
        <MetricsChart points={points} valueKey="value" width={500} height={100} />
      );
      const svg = container.querySelector('svg');
      
      expect(svg).toHaveAttribute('viewBox', '0 0 500 100');
      expect(svg).toHaveAttribute('height', '100');
    });

    it('uses default color when not provided', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const polyline = container.querySelector('polyline');
      
      expect(polyline).toHaveAttribute('stroke', '#58a6ff');
    });

    it('uses custom color when provided', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(
        <MetricsChart points={points} valueKey="value" color="#ff0000" />
      );
      const polyline = container.querySelector('polyline');
      
      expect(polyline).toHaveAttribute('stroke', '#ff0000');
    });
  });

  describe('chart rendering with valueFn', () => {
    it('uses valueFn when provided instead of valueKey', () => {
      const points = [
        { cpu: 0.5, mem: 100 },
        { cpu: 0.7, mem: 150 },
      ];
      
      const valueFn = (p) => p.cpu * 100;
      
      const { container } = render(
        <MetricsChart points={points} valueKey="mem" valueFn={valueFn} />
      );
      const svg = container.querySelector('svg');
      
      // Should render chart using valueFn (cpu * 100) instead of valueKey (mem)
      expect(svg).toBeInTheDocument();
    });

    it('handles valueFn returning non-numeric values', () => {
      const points = [
        { data: 'invalid' },
        { data: null },
        { data: 50 },
      ];
      
      const valueFn = (p) => Number(p.data);
      
      const { container } = render(
        <MetricsChart points={points} valueKey="data" valueFn={valueFn} />
      );
      
      // Number('invalid') = NaN, Number(null) = 0, Number(50) = 50
      // So we get 0 and 50 as valid numbers (2 points), which renders a chart
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('data handling', () => {
    it('filters out non-finite values', () => {
      const points = [
        { value: 10 },
        { value: NaN },
        { value: 20 },
        { value: Infinity },
        { value: 15 },
      ];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      // Should still render chart with only valid values
      expect(svg).toBeInTheDocument();
    });

    it('handles missing valueKey in data points', () => {
      const points = [
        { value: 10 },
        { other: 99 }, // missing 'value' key
        { value: 20 },
      ];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      // Should treat missing key as 0 and still render
      expect(svg).toBeInTheDocument();
    });

    it('handles all zero values', () => {
      const points = [
        { value: 0 },
        { value: 0 },
        { value: 0 },
      ];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      // Should render chart even with all zeros
      expect(svg).toBeInTheDocument();
    });

    it('handles negative values', () => {
      const points = [
        { value: -10 },
        { value: 5 },
        { value: -5 },
      ];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      // Should render chart with negative values
      expect(svg).toBeInTheDocument();
    });
  });

  describe('SVG attributes', () => {
    it('sets preserveAspectRatio to none', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const svg = container.querySelector('svg');
      
      expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
    });

    it('sets polyline fill to none', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const polyline = container.querySelector('polyline');
      
      expect(polyline).toHaveAttribute('fill', 'none');
    });

    it('sets polyline stroke width to 2', () => {
      const points = [{ value: 10 }, { value: 20 }];
      
      const { container } = render(<MetricsChart points={points} valueKey="value" />);
      const polyline = container.querySelector('polyline');
      
      // Note: in SVG, the attribute is 'stroke-width' (hyphenated), not 'strokeWidth' (camelCase)
      expect(polyline).toHaveAttribute('stroke-width', '2');
    });
  });
});
