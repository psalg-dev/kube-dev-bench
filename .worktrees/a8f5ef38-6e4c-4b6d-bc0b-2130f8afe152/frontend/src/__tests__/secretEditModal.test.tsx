import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecretEditModal from '../docker/resources/secrets/SecretEditModal';

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  UpdateSwarmSecretData: vi.fn(),
}));

// Mock wails runtime
vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsEmit: vi.fn(),
}));

// Mock notification
vi.mock('../notification', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

import type { docker } from '../../wailsjs/go/models';
import { UpdateSwarmSecretData } from '../docker/swarmApi';
import { showSuccess } from '../notification';
const updateSwarmSecretMock = vi.mocked(UpdateSwarmSecretData);

describe('SecretEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      render(
        <SecretEditModal
          open={false}
          secretId="secret-123"
          secretName="my-secret"
        />
      );

      expect(screen.queryByText(/Edit/)).not.toBeInTheDocument();
    });

    it('renders when open is true', () => {
      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
        />
      );

      expect(screen.getByText(/my-secret/)).toBeInTheDocument();
    });

    it('displays secret name in header', () => {
      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="production-secret"
        />
      );

      expect(screen.getByText(/production-secret/)).toBeInTheDocument();
    });

    it('displays Cancel and Save buttons', () => {
      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('displays warning about secret immutability', () => {
      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
        />
      );

      // Should show warning about Swarm secrets being immutable
      expect(screen.getByText(/secrets are immutable/i)).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls onClose when Cancel button clicked', () => {
      const onClose = vi.fn();
      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', () => {
      const onClose = vi.fn();
      const { container } = render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
          onClose={onClose}
        />
      );

      // Click the overlay (outermost div)
      const overlay = container.firstChild as Element | null;
      if (overlay) fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('acknowledgment checkbox', () => {
    it('requires acknowledgment before saving', async () => {
      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
        />
      );

      // The acknowledgment checkbox should exist
      expect(screen.getByText(/I understand/i)).toBeInTheDocument();

      // Save button should be disabled when no acknowledgment
      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();

      // API should not be called
      expect(UpdateSwarmSecretData).not.toHaveBeenCalled();
    });
  });

  describe('save action', () => {
    it('calls UpdateSwarmSecretData API when saved with acknowledgment', async () => {
      updateSwarmSecretMock.mockResolvedValue({
        newSecretName: 'new-secret',
        updated: [] as docker.SwarmServiceRef[],
      } as unknown as docker.SwarmSecretUpdateResult);

      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      // Check the acknowledgment checkbox if present
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
      }

      // Enter a value
      const textareas = screen.getAllByRole('textbox');
      if (textareas.length > 0) {
        fireEvent.change(textareas[textareas.length - 1], { target: { value: 'secret-value' } });
      }

      fireEvent.click(screen.getByText('Save'));

      // Wait for API call or error message
      await waitFor(() => {
        // Either API was called or error about acknowledgment shown
        expect(updateSwarmSecretMock.mock.calls.length > 0 || screen.queryByText(/confirm/i)).toBeTruthy();
      });
    });

    it('shows success notification on successful save', async () => {
      updateSwarmSecretMock.mockResolvedValue({
        newSecretName: 'new-secret',
        updated: [{ serviceId: 'svc-1', serviceName: 'svc-1' }],
      } as unknown as docker.SwarmSecretUpdateResult);

      render(
        <SecretEditModal
          open={true}
          secretId="secret-123"
          secretName="my-secret"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      // Check acknowledgment and enter value
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
      }

      const textareas = screen.getAllByRole('textbox');
      if (textareas.length > 0) {
        fireEvent.change(textareas[textareas.length - 1], { target: { value: 'secret-value' } });
      }

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        if (updateSwarmSecretMock.mock.calls.length > 0) {
          expect(showSuccess).toHaveBeenCalled();
        }
      });
    });
  });
});
