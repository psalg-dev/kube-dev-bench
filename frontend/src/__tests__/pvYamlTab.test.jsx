import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PersistentVolumeYamlTab from '../k8s/resources/persistentvolumes/PersistentVolumeYamlTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetPersistentVolumeYAML: vi.fn(),
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

import * as AppAPI from '../../wailsjs/go/main/App';

describe('PersistentVolumeYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetPersistentVolumeYAML.mockImplementation(
        () => new Promise(() => {}),
      );

      render(<PersistentVolumeYamlTab name="my-pv" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays PV name in header', async () => {
      AppAPI.GetPersistentVolumeYAML.mockResolvedValue('');

      render(<PersistentVolumeYamlTab name="nfs-pv-1" />);

      expect(screen.getByText(/YAML for nfs-pv-1/)).toBeInTheDocument();
    });

    it('displays action buttons', async () => {
      AppAPI.GetPersistentVolumeYAML.mockResolvedValue('');

      render(<PersistentVolumeYamlTab name="my-pv" />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetPersistentVolumeYAML.mockRejectedValue(
        new Error('PV not found'),
      );

      render(<PersistentVolumeYamlTab name="my-pv" />);

      await waitFor(() => {
        expect(screen.getByText(/PV not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      AppAPI.GetPersistentVolumeYAML.mockResolvedValue('capacity: 10Gi');

      render(<PersistentVolumeYamlTab name="my-pv" />);

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeYAML).toHaveBeenCalledWith('my-pv');
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: v1\nkind: PersistentVolume';
      AppAPI.GetPersistentVolumeYAML.mockResolvedValue(mockYaml);

      render(<PersistentVolumeYamlTab name="my-pv" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when name is missing', async () => {
      render(<PersistentVolumeYamlTab name="" />);

      await new Promise((r) => setTimeout(r, 50));

      expect(AppAPI.GetPersistentVolumeYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when name changes', async () => {
      AppAPI.GetPersistentVolumeYAML.mockResolvedValue('yaml: content');

      const { rerender } = render(<PersistentVolumeYamlTab name="pv-1" />);

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeYAML).toHaveBeenCalledWith('pv-1');
      });

      rerender(<PersistentVolumeYamlTab name="pv-2" />);

      await waitFor(() => {
        expect(AppAPI.GetPersistentVolumeYAML).toHaveBeenCalledWith('pv-2');
      });
    });
  });
});
