import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyTabContent from '../components/EmptyTabContent';

describe('EmptyTabContent', () => {
  it('renders with title', () => {
    render(<EmptyTabContent title="No events yet" />);
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('renders with description', () => {
    render(
      <EmptyTabContent
        title="No data"
        description="No items have been recorded for this resource."
      />
    );
    expect(
      screen.getByText('No items have been recorded for this resource.')
    ).toBeInTheDocument();
  });

  it('renders with tip', () => {
    render(
      <EmptyTabContent
        title="No pods running"
        tip="Pods will appear here once the workload starts."
      />
    );
    expect(
      screen.getByText('Pods will appear here once the workload starts.')
    ).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    const { container } = render(
      <EmptyTabContent icon="🐋" title="No pods" />
    );
    const iconElement = container.querySelector('.empty-tab-icon');
    expect(iconElement).toHaveTextContent('🐋');
  });

  it('renders icon from preset icons', () => {
    const { container } = render(
      <EmptyTabContent icon="events" title="No events" />
    );
    const iconElement = container.querySelector('.empty-tab-icon');
    expect(iconElement).toHaveTextContent('📋');
  });

  it('renders default icon when none specified', () => {
    const { container } = render(<EmptyTabContent title="No data" />);
    const iconElement = container.querySelector('.empty-tab-icon');
    expect(iconElement).toHaveTextContent('📭');
  });

  it('renders action button when provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyTabContent
        title="No resources"
        onAction={handleAction}
        actionLabel="Create one"
      />
    );
    const button = screen.getByRole('button', { name: 'Create one' });
    expect(button).toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', () => {
    const handleAction = vi.fn();
    render(
      <EmptyTabContent
        title="No resources"
        onAction={handleAction}
        actionLabel="Create one"
      />
    );
    const button = screen.getByRole('button', { name: 'Create one' });
    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when only onAction is provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyTabContent
        title="No resources"
        onAction={handleAction}
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button when only actionLabel is provided', () => {
    render(
      <EmptyTabContent
        title="No resources"
        actionLabel="Create one"
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyTabContent
        title="Test"
        className="custom-empty-state"
      />
    );
    const wrapper = container.querySelector('.empty-tab-content');
    expect(wrapper).toHaveClass('custom-empty-state');
  });

  it('renders all props together', () => {
    const handleAction = vi.fn();
    const { container } = render(
      <EmptyTabContent
        icon="pods"
        title="No pods running"
        description="No pods are currently associated with this resource."
        tip="Pods will appear here once the workload starts creating them."
        onAction={handleAction}
        actionLabel="View workloads"
      />
    );

    expect(container.querySelector('.empty-tab-icon')).toHaveTextContent('🐋');
    expect(screen.getByText('No pods running')).toBeInTheDocument();
    expect(
      screen.getByText('No pods are currently associated with this resource.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pods will appear here once the workload starts creating them.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View workloads' })
    ).toBeInTheDocument();
  });
});
