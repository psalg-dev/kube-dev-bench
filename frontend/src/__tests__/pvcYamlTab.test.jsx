import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PersistentVolumeClaimYamlTab from '../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimYamlTab';

// Mock the Wails App API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetPersistentVolumeClaimYAML: vi.fn(),
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

describe('PersistentVolumeClaimYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      AppAPI.GetPersistentVolumeClaimYAML.mockImplementation(() => new Promise(() => {}));
      
      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);
      
      expect(screen.getByText(/loading yaml/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays PVC name in header', async () => {
      AppAPI.GetPersistentVolumeClaimYAML.mockResolvedValue('');
      
      render(<PersistentVolumeClaimYamlTab namespace="default" name="data-pvc" />);
      
      expect(screen.getByText(/YAML for data-pvc/)).toBeInTheDocument();
    });

    it('displays action buttons', async () => {
      AppAPI.GetPersistentVolumeClaimYAML.mockResolvedValue('');
      
      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);
      
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      AppAPI.GetPersistentVolumeClaimYAML.mockRejectedValue(new Error('PVC not found'));
      
      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);
      
      await waitFor(() => {
        expect(screen.getByText(/PVC not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      AppAPI.GetPersistentVolumeClaimYAML.mockResolvedValue('spec:\n  resources: {}');
      
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
      AppAPI.GetPersistentVolumeClaimYAML.mockResolvedValue(mockYaml);
      
      render(<PersistentVolumeClaimYamlTab namespace="default" name="my-pvc" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading yaml/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<PersistentVolumeClaimYamlTab namespace="" name="my-pvc" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetPersistentVolumeClaimYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<PersistentVolumeClaimYamlTab namespace="default" name="" />);
      
      await new Promise(r => setTimeout(r, 50));
      
      expect(AppAPI.GetPersistentVolumeClaimYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      AppAPI.GetPersistentVolumeClaimYAML.mockResolvedValue('yaml: content');
      
      const { rerender } = render(<PersistentVolumeClaimYamlTab namespace="ns1" name="pvc-1" />);
      
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
