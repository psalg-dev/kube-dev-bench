import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TabLabel from '../components/TabLabel';

describe('TabLabel', () => {
  it('renders label text correctly', () => {
    render(<TabLabel label="Events" />);
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('renders count badge when count is provided', () => {
    render(<TabLabel label="Events" count={5} />);
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders zero count with empty styling', () => {
    const { container } = render(<TabLabel label="Pods" count={0} />);
    expect(screen.getByText('Pods')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    const countBadge = container.querySelector('.tab-count');
    expect(countBadge).toHaveClass('tab-count-empty');
  });

  it('applies muted styling when count is 0', () => {
    const { container } = render(<TabLabel label="Consumers" count={0} />);
    const tabLabel = container.querySelector('.tab-label');
    expect(tabLabel).toHaveClass('tab-label-muted');
  });

  it('does not apply muted styling when count is greater than 0', () => {
    const { container } = render(<TabLabel label="Consumers" count={3} />);
    const tabLabel = container.querySelector('.tab-label');
    expect(tabLabel).not.toHaveClass('tab-label-muted');
  });

  it('shows loading indicator when loading is true', () => {
    render(<TabLabel label="Events" loading={true} />);
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('shows count even when loading to prevent flicker', () => {
    render(<TabLabel label="Events" count={5} loading={true} />);
    // Count should be shown even during loading to prevent flicker
    expect(screen.getByText('5')).toBeInTheDocument();
    // Loading indicator should NOT be shown when we already have a count
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('does not show count when showCount is false', () => {
    render(<TabLabel label="Summary" count={10} showCount={false} />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });

  it('handles undefined count gracefully', () => {
    render(<TabLabel label="YAML" />);
    expect(screen.getByText('YAML')).toBeInTheDocument();
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TabLabel label="Test" className="custom-class" />);
    const tabLabel = container.querySelector('.tab-label');
    expect(tabLabel).toHaveClass('custom-class');
  });

  it('has correct aria-label for count badge', () => {
    render(<TabLabel label="Events" count={7} />);
    const badge = screen.getByLabelText('7 items');
    expect(badge).toBeInTheDocument();
  });

  it('has correct aria-label for loading indicator', () => {
    render(<TabLabel label="Events" loading={true} />);
    const loading = screen.getByLabelText('Loading count');
    expect(loading).toBeInTheDocument();
  });
});
