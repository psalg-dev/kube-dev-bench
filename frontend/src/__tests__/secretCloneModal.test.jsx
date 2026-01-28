import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SecretCloneModal from '../docker/resources/secrets/SecretCloneModal';

// Mock swarmApi
vi.mock('../docker/swarmApi.js', () => ({
  CloneSwarmSecret: vi.fn(),
}));

// Mock wails runtime
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsEmit: vi.fn(),
}));

// Mock notification
vi.mock('../notification.js', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

import { CloneSwarmSecret } from '../docker/swarmApi.js';
import { showError, showSuccess } from '../notification.js';

describe('SecretCloneModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      render(
        <SecretCloneModal
          open={false}
          sourceId="secret-123"
          sourceName="my-secret"
        />
      );
      
      expect(screen.queryByText(/Clone Secret/)).not.toBeInTheDocument();
    });

    it('renders when open is true', () => {
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
        />
      );
      
      expect(screen.getByText(/Clone Swarm secret/)).toBeInTheDocument();
    });

    it('displays source secret name in header', () => {
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="production-secret"
        />
      );
      
      expect(screen.getByText(/production-secret/)).toBeInTheDocument();
    });

    it('displays name input field', () => {
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
        />
      );
      
      // Check for the name input by its label text
      expect(screen.getByText(/New secret name/i)).toBeInTheDocument();
    });

    it('displays Cancel and Create buttons', () => {
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
        />
      );
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
  });

  describe('input behavior', () => {
    it('allows entering secret name', () => {
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
        />
      );
      
      const inputs = screen.getAllByRole('textbox');
      // First input is typically the name field
      fireEvent.change(inputs[0], { target: { value: 'new-secret-name' } });
      
      expect(inputs[0].value).toBe('new-secret-name');
    });
  });

  describe('button interactions', () => {
    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
          onClose={onClose}
        />
      );
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', () => {
      const onClose = vi.fn();
      const { container } = render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
          onClose={onClose}
        />
      );
      
      // Click the overlay (outermost div)
      const overlay = container.firstChild;
      fireEvent.click(overlay);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('clone action', () => {
    it('calls CloneSwarmSecret API on Create click', async () => {
      CloneSwarmSecret.mockResolvedValue({});
      
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
          onClose={vi.fn()}
        />
      );
      
      // Enter name and value
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'new-secret' } });
      if (inputs[1]) {
        fireEvent.change(inputs[1], { target: { value: 'secret-value' } });
      }
      
      fireEvent.click(screen.getByText('Create'));
      
      await waitFor(() => {
        expect(CloneSwarmSecret).toHaveBeenCalled();
      });
    });

    it('shows success notification on successful clone', async () => {
      CloneSwarmSecret.mockResolvedValue({});
      
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      );
      
      // Enter required fields
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'new-secret' } });
      if (inputs[1]) {
        fireEvent.change(inputs[1], { target: { value: 'secret-value' } });
      }
      
      fireEvent.click(screen.getByText('Create'));
      
      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalled();
      });
    });

    it('shows error notification on clone failure', async () => {
      CloneSwarmSecret.mockRejectedValue(new Error('Clone failed'));
      
      render(
        <SecretCloneModal
          open={true}
          sourceId="secret-123"
          sourceName="my-secret"
          onClose={vi.fn()}
        />
      );
      
      // Enter required fields
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'new-secret' } });
      if (inputs[1]) {
        fireEvent.change(inputs[1], { target: { value: 'secret-value' } });
      }
      
      fireEvent.click(screen.getByText('Create'));
      
      await waitFor(() => {
        expect(showError).toHaveBeenCalled();
      });
    });
  });
});
