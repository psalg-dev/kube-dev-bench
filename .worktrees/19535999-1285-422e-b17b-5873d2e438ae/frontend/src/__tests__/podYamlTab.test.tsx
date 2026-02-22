import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PodYamlTab from '../k8s/resources/pods/PodYamlTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetPodYAML: vi.fn(),
}));

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

Object.assign(globalThis.URL, {
  createObjectURL: vi.fn(() => 'blob:test'),
  revokeObjectURL: vi.fn(),
});

import * as AppAPI from '../../wailsjs/go/main/App';

const getPodYamlMock = vi.mocked(AppAPI.GetPodYAML);

describe('PodYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getPodYamlMock.mockImplementation(() => new Promise(() => {}));

      render(<PodYamlTab podName="my-pod" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays YAML content when loaded', async () => {
      const mockYaml = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: my-pod';
      getPodYamlMock.mockResolvedValue(mockYaml);

      render(<PodYamlTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('shows pod name in header', async () => {
      getPodYamlMock.mockResolvedValue('');

      render(<PodYamlTab podName="test-pod" />);

      await waitFor(() => {
        expect(AppAPI.GetPodYAML).toHaveBeenCalledWith('test-pod');
        expect(screen.getByText(/YAML for test-pod/)).toBeInTheDocument();
      });
    });

    it('displays action buttons', async () => {
      getPodYamlMock.mockResolvedValue('');

      render(<PodYamlTab podName="my-pod" />);

      await waitFor(() => {
        expect(AppAPI.GetPodYAML).toHaveBeenCalledWith('my-pod');
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getPodYamlMock.mockRejectedValue(new Error('Connection failed'));

      render(<PodYamlTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      getPodYamlMock.mockResolvedValue('yaml: content');

      render(<PodYamlTab podName="my-pod" />);

      await waitFor(() => {
        expect(AppAPI.GetPodYAML).toHaveBeenCalledWith('my-pod');
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetPodYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: v1';
      getPodYamlMock.mockResolvedValue(mockYaml);

      render(<PodYamlTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });

    it('has download button available', async () => {
      getPodYamlMock.mockResolvedValue('apiVersion: v1');

      render(<PodYamlTab podName="my-pod" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const downloadBtn = screen.getByText('Download');
      expect(downloadBtn).toBeInTheDocument();

      fireEvent.click(downloadBtn);
    });
  });

  describe('API calls', () => {
    it('does not call API when podName is missing', async () => {
      render(<PodYamlTab podName="" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetPodYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when podName changes', async () => {
      getPodYamlMock.mockResolvedValue('yaml: content');

      const { rerender } = render(<PodYamlTab podName="pod-1" />);

      await waitFor(() => {
        expect(AppAPI.GetPodYAML).toHaveBeenCalledWith('pod-1');
      });

      rerender(<PodYamlTab podName="pod-2" />);

      await waitFor(() => {
        expect(AppAPI.GetPodYAML).toHaveBeenCalledWith('pod-2');
      });
    });
  });
});
