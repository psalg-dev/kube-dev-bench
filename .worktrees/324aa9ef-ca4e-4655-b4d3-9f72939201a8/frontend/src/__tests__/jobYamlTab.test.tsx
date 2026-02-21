import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JobYamlTab from '../k8s/resources/jobs/JobYamlTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  GetJobYAML: vi.fn(),
}));

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

import * as AppAPI from '../../wailsjs/go/main/App';

const getJobYamlMock = vi.mocked(AppAPI.GetJobYAML);

describe('JobYamlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading initially', () => {
      getJobYamlMock.mockImplementation(() => new Promise(() => {}));

      render(<JobYamlTab namespace="default" name="my-job" />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('displays job name in header', async () => {
      getJobYamlMock.mockResolvedValue('');

      render(<JobYamlTab namespace="default" name="batch-job" />);

      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('default', 'batch-job');
        expect(screen.getByText(/YAML for batch-job/)).toBeInTheDocument();
      });
    });

    it('displays action buttons', async () => {
      getJobYamlMock.mockResolvedValue('');

      render(<JobYamlTab namespace="default" name="my-job" />);

      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('default', 'my-job');
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error when API call fails', async () => {
      getJobYamlMock.mockRejectedValue(new Error('Job not found'));

      render(<JobYamlTab namespace="default" name="my-job" />);

      await waitFor(() => {
        expect(screen.getByText(/Job not found/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls API on refresh button click', async () => {
      getJobYamlMock.mockResolvedValue('completions: 1');

      render(<JobYamlTab namespace="default" name="my-job" />);

      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('default', 'my-job');
      });

      fireEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledTimes(2);
      });
    });

    it('copies content to clipboard on copy button click', async () => {
      const mockYaml = 'apiVersion: batch/v1\nkind: Job';
      getJobYamlMock.mockResolvedValue(mockYaml);

      render(<JobYamlTab namespace="default" name="my-job" />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Copy'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockYaml);
    });
  });

  describe('API calls', () => {
    it('does not call API when namespace is missing', async () => {
      render(<JobYamlTab namespace="" name="my-job" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetJobYAML).not.toHaveBeenCalled();
    });

    it('does not call API when name is missing', async () => {
      render(<JobYamlTab namespace="default" name="" />);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(AppAPI.GetJobYAML).not.toHaveBeenCalled();
    });

    it('re-fetches when props change', async () => {
      getJobYamlMock.mockResolvedValue('yaml: content');

      const { rerender } = render(<JobYamlTab namespace="ns1" name="job-1" />);

      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('ns1', 'job-1');
      });

      rerender(<JobYamlTab namespace="ns2" name="job-2" />);

      await waitFor(() => {
        expect(AppAPI.GetJobYAML).toHaveBeenCalledWith('ns2', 'job-2');
      });
    });
  });
});
