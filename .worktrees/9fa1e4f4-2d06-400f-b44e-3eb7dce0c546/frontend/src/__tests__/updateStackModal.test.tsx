import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateStackModal from '../docker/resources/stacks/UpdateStackModal';

describe('UpdateStackModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      render(
        <UpdateStackModal
          open={false}
          stackName="my-stack"
          initialComposeYAML="version: '3.8'"
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByText('Update Stack:')).not.toBeInTheDocument();
    });

    it('renders when open is true', () => {
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML="version: '3.8'"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Update Stack:/)).toBeInTheDocument();
    });

    it('displays stack name in header', () => {
      render(
        <UpdateStackModal
          open={true}
          stackName="production-stack"
          initialComposeYAML=""
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/production-stack/)).toBeInTheDocument();
    });

    it('displays Close button', () => {
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML=""
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('displays redeploy description', () => {
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML=""
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/stack redeploy/)).toBeInTheDocument();
    });
  });

  describe('textarea behavior', () => {
    it('displays initial compose YAML', () => {
      const yaml = 'version: "3.8"\nservices:\n  web: {}';
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML={yaml}
          onClose={vi.fn()}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(yaml);
    });

    it('allows editing yaml content', () => {
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML=""
          onClose={vi.fn()}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'version: "3.9"' } });

      expect(textarea.value).toBe('version: "3.9"');
    });
  });

  describe('button interactions', () => {
    it('calls onClose when Close button clicked', () => {
      const onClose = vi.fn();
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML=""
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', () => {
      const onClose = vi.fn();
      const { container } = render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML=""
          onClose={onClose}
        />
      );

      // Click the overlay (outermost div)
      const overlay = container.firstChild as Element | null;
      if (overlay) fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', () => {
      const onClose = vi.fn();
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML=""
          onClose={onClose}
        />
      );

      // Click on the stack name text (inside modal)
      fireEvent.click(screen.getByText(/Update Stack:/));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Redeploy button', () => {
    it('renders Redeploy button', () => {
      render(
        <UpdateStackModal
          open={true}
          stackName="my-stack"
          initialComposeYAML="version: '3.8'"
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(screen.getByText('Redeploy')).toBeInTheDocument();
    });
  });
});
