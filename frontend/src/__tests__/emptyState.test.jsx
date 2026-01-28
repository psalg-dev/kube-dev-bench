import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '../components/EmptyState';

describe('EmptyState', () => {
  describe('rendering', () => {
    it('renders with title', () => {
      render(<EmptyState title="No data available" />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('renders with message', () => {
      render(
        <EmptyState title="Empty" message="There are no items to display." />,
      );
      expect(
        screen.getByText('There are no items to display.'),
      ).toBeInTheDocument();
    });

    it('renders with hint', () => {
      render(
        <EmptyState title="No files" hint="Upload a file to get started." />,
      );
      expect(
        screen.getByText('Upload a file to get started.'),
      ).toBeInTheDocument();
    });

    it('renders all text elements together', () => {
      render(
        <EmptyState
          title="No pods"
          message="This deployment has no pods."
          hint="Wait for the workload to start."
        />,
      );
      expect(screen.getByText('No pods')).toBeInTheDocument();
      expect(
        screen.getByText('This deployment has no pods.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Wait for the workload to start.'),
      ).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders custom emoji icon', () => {
      const { container } = render(
        <EmptyState icon="🎉" title="Celebration" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('🎉');
    });

    it('renders icon from preset icons - files', () => {
      const { container } = render(
        <EmptyState icon="files" title="No files" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('📁');
    });

    it('renders icon from preset icons - error', () => {
      const { container } = render(<EmptyState icon="error" title="Error" />);
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('⚠️');
    });

    it('renders icon from preset icons - search', () => {
      const { container } = render(
        <EmptyState icon="search" title="No results" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('🔍');
    });

    it('renders icon from preset icons - container', () => {
      const { container } = render(
        <EmptyState icon="container" title="No containers" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('📦');
    });

    it('renders icon from preset icons - network', () => {
      const { container } = render(
        <EmptyState icon="network" title="No network" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('🌐');
    });

    it('renders icon from preset icons - storage', () => {
      const { container } = render(
        <EmptyState icon="storage" title="No storage" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('💾');
    });

    it('renders icon from preset icons - config', () => {
      const { container } = render(
        <EmptyState icon="config" title="No config" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('⚙️');
    });

    it('renders icon from preset icons - secret', () => {
      const { container } = render(
        <EmptyState icon="secret" title="No secrets" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('🔐');
    });

    it('renders icon from preset icons - pod', () => {
      const { container } = render(<EmptyState icon="pod" title="No pods" />);
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('🐋');
    });

    it('renders icon from preset icons - service', () => {
      const { container } = render(
        <EmptyState icon="service" title="No services" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('🔌');
    });

    it('renders default icon when none specified', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const iconElement = container.querySelector('.empty-state-icon');
      expect(iconElement).toHaveTextContent('📭');
    });

    it('renders default icon for unknown icon key', () => {
      const { container } = render(
        <EmptyState icon="unknownIconKey" title="Empty" />,
      );
      const iconElement = container.querySelector('.empty-state-icon');
      // Should use the icon key as-is when not in preset
      expect(iconElement).toHaveTextContent('unknownIconKey');
    });
  });

  describe('action button', () => {
    it('renders action button when onAction and actionLabel are provided', () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          title="No items"
          onAction={handleAction}
          actionLabel="Add Item"
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Add Item' }),
      ).toBeInTheDocument();
    });

    it('calls onAction when button is clicked', () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          title="No items"
          onAction={handleAction}
          actionLabel="Create"
        />,
      );
      const button = screen.getByRole('button', { name: 'Create' });
      fireEvent.click(button);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });

    it('does not render button when only onAction is provided', () => {
      const handleAction = vi.fn();
      render(<EmptyState title="No items" onAction={handleAction} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('does not render button when only actionLabel is provided', () => {
      render(<EmptyState title="No items" actionLabel="Create" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <EmptyState title="Test" className="custom-empty-state" />,
      );
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toHaveClass('custom-empty-state');
    });

    it('preserves base class when custom className is added', () => {
      const { container } = render(
        <EmptyState title="Test" className="custom-class" />,
      );
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toHaveClass('empty-state');
      expect(emptyState).toHaveClass('custom-class');
    });
  });
});
