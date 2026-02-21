import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PersistentVolumeClaimYamlTab from '../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPersistentVolumeClaimYAML: vi.fn(),
}));

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

const getPvcYamlMock = vi.mocked(AppAPI.GetPersistentVolumeClaimYAML);

describe('PersistentVolumeClaimYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getPvcYamlMock.mockImplementation(() => new Promise(() => {}));

      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays PVC name in header', async () => {
      getPvcYamlMock.mockResolvedValue('');

      render(<PersistentVolumeClaimYamlTab namespace="default" name="data-pvc" />);

      await waitFor(() => {
        expect(screen.getByText(/YAML for data-pvc/)).toBeInTheDocument();
      });
    });

    it('displays action buttons', async () => {
      getPvcYamlMock.mockResolvedValue('');

      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getPvcYamlMock.mockRejectedValue(new Error('PVC not found'));

      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);

      await waitFor(() => {
        expect(screen.getByText(/PVC not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      getPvcYamlMock.mockResolvedValue('spec:\n  resources: {}');

      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeClaimYAML).toHaveBeenCalledWith('default', 'my-pvc');
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeClaimYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: v1\nkind: PersistentVolumeClaim';
      getPvcYamlMock.mockResolvedValue(mockYaml);

      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<PersistentVolumeClaimYamlTab namespace="" name="my-pvc" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetPersistentVolumeClaimYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<PersistentVolumeClaimYamlTab namespace="default" name="" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetPersistentVolumeClaimYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      getPvcYamlMock.mockResolvedValue('yaml: content');

      const { rerender } = render(
        <PersistentVolumeClaimYamlTab namespace="ns1" name="pvc-1" />
      );

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeClaimYAML).toHaveBeenCalledWith('ns1', 'pvc-1');
      });

      rerender(<PersistentVolumeClaimYamlTab namespace="ns2" name="pvc-2" />);

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeClaimYAML).toHaveBeenCalledWith('ns2', 'pvc-2');
      });
    });
  });
});
